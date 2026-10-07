# 04: testing and debugging the invariant

The suite has three Vitest files, 14 tests in total (counted from the `it(` calls: 9 + 3 + 2).

| file | tests | needs | what it proves |
| --- | --- | --- | --- |
| `tests/inventoryRules.test.ts` | 9 | nothing | the pure rules: ATP, planning, aggregation, invalid input, apply, ship, low stock |
| `tests/api.test.ts` | 3 | Prisma client + seeded SQLite | health, dashboard read, CSV export |
| `tests/reservation-api.test.ts` | 2 | Prisma client + seeded SQLite | the reserve route: refusal changes no stock, success writes one row per SKU |

## The pure regression tests

The planner regressions belong in `tests/inventoryRules.test.ts` because the failure is in a pure function. The aggregation test (`tests/inventoryRules.test.ts:38`) supplies two lines for `sku-pack-green`, quantities 14 and 9, and expects one failure for 23 against 22 available. This test would fail against the snapshot implementation: both independent comparisons pass and `decision.ok` would be true. It describes the production failure mode rather than asserting an internal `Map`.

```ts
  it('aggregates duplicate SKU lines before checking availability', () => {
    const decision = planReservation(
      [
        { skuId: 'sku-pack-green', quantity: 14 },
        { skuId: 'sku-pack-green', quantity: 9 },
      ],
      [balance],
    )

    expect(decision.ok).toBe(false)
    expect(decision.failures).toEqual([
      expect.objectContaining({
        skuId: 'sku-pack-green',
        requested: 23,
        available: 22,
      }),
    ])
  })
```

The next test (`:57`) passes zero, negative one, `1.5`, and `Number.POSITIVE_INFINITY` and checks that all four fail with a reason naming a positive whole number. The `applyReservation` test (`:77`) verifies that zero throws a validation error and that 23 throws an availability error. There is no pure test for a valid quantity against a missing balance, and none for invalid `applyShipment` input; exercises 3 and 5 add them.

## The persistence regression test

`tests/reservation-api.test.ts` creates order `so-test-aggregate` with two lines for `sku-pack-black` in `wh-west`: one line equal to the whole available quantity and one line of 1. Each fits alone; together they exceed availability by one. The first case asserts HTTP 200 with `ok: false`, one failure with `requested: available + 1`, unchanged `reserved`, unchanged `StockReservation` count, exactly one `order.reservation_failed` audit row, and the order still `pending_reservation`. The second case shrinks line 1 to one unit, reserves again, and asserts one reservation row of quantity 2 and `reserved` up by 2, then resets `reserved` by hand.

Two things to know when debugging it. First, the request sends no `x-user-id` header and still passes `requireRole(['warehouse_manager', 'admin'])`; that works only because a missing header resolves to the seeded admin (finding F1 in `06`). Second, its `afterAll` (`tests/reservation-api.test.ts:37-42`) deletes audit rows, reservation rows, lines and the order, but not the `DomainEvent` and `OutboxMessage` the success case creates. Each full run leaves one `order.reserved` event and one pending outbox row in `prisma/dev.db` until the next `db:seed`.

## Commands and a debugging table

Fastest loop, no install: the `node --experimental-strip-types --test` checks in `05-PRACTICE.md`. With dependencies installed: `npm test -- --run tests/inventoryRules.test.ts`, then (after the database steps in `VERIFICATION.md`) `npm test` and `npm run typecheck`. If a test fails, print the actual failure object or use Vitest's verbose reporter; do not change expected values just to make the suite green. If TypeScript reports a type error around `Array.from(requestedBySku, ...)`, check that the callback returns `{ skuId, quantity }` and that the `flatMap` callback returns arrays on every path.

A useful debugging table is: input lines, grouped demand, matching balance, available stock, decision, writes.

| lines | grouped | balance (onHand/reserved) | available | decision | writes |
| --- | --- | --- | --- | --- | --- |
| 14, 9 | 23 | 42/20 | 22 | fail | one `order.reservation_failed` audit row only |
| 18 | 18 | 42/20 | 22 | ok | one increment, one reservation row, status, event, outbox, audit |

This table separates a planner bug (wrong decision) from a transaction bug (right decision, wrong writes). None of the three files exercises two reservations racing for the same balance.
