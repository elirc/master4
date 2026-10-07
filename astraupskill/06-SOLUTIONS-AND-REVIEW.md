# 06: solutions and senior review

Answers to [05-PRACTICE.md](05-PRACTICE.md), in the same order, followed by review findings in the code as it stands. Exercises 1-6 were run with `node --experimental-strip-types --test` on Node 22.16 against the current `src/shared/inventoryRules.ts` (1-4 and 6 pass, 5 fails as described), against a copy with the Exercise 5 fix (all 6 pass), and against the pre-change snapshot (1, 2, 4 and 5 fail; 3 and 6 pass).

## Exercise 1

```ts
test('1: duplicate lines compete for one stock pool', () => {
  const decision = planReservation(
    [{ skuId: balance.skuId, quantity: 14 }, { skuId: balance.skuId, quantity: 9 }],
    [balance],
  )
  assert.deepEqual(decision, {
    ok: false,
    failures: [{ skuId: balance.skuId, requested: 23, available: 22, reason: 'Requested quantity exceeds available-to-promise inventory.' }],
  })
  assert.deepEqual(planReservation([{ skuId: balance.skuId, quantity: 18 }], [balance]), { ok: true, failures: [] })
})
```

The snapshot computes `14 > 22` and `9 > 22`, both false, and returns `{ ok: true, failures: [] }`. The current planner accumulates 14, then 23, in `requestedBySku` and compares that one total with 22. The assertion is behavioral: it does not care that the implementation uses a `Map`.

## Exercise 2

```ts
test('2: invalid quantities are reported, never aggregated, and never applied', () => {
  for (const quantity of [0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN, 2 ** 53]) {
    const decision = planReservation([{ skuId: balance.skuId, quantity }, { skuId: balance.skuId, quantity: 5 }], [balance])
    assert.equal(decision.failures.length, 1, `quantity ${quantity}`)
    assert.equal(decision.failures[0].available, 0)
    assert.match(decision.failures[0].reason, /positive whole number/)
    assert.throws(() => applyReservation(balance, quantity), /positive whole number/)
  }
  assert.throws(() => applyReservation(balance, 23), /currently available/)
})
```

`available: 0` in an invalid-input failure is a placeholder (`inventoryRules.ts:47`), not an inventory reading. The valid 5 fits and adds no failure, which is how you know the invalid line never entered the grouped map. `2 ** 53` fails because `Number.isSafeInteger` stops at `2 ** 53 - 1`.

## Exercise 3

```ts
test('3: a SKU never stocked in this warehouse fails with available 0', () => {
  assert.deepEqual(planReservation([{ skuId: 'sku-never-stocked', quantity: 1 }], [balance]).failures, [
    { skuId: 'sku-never-stocked', requested: 1, available: 0, reason: 'No inventory balance exists for this SKU in the selected warehouse.' },
  ])
})
```

The `continue` at `orders.service.ts:84-88` is unreachable on the success path today, because a missing balance always fails the plan and the service returns at `:72`. It stays because the loop must never write against a balance it does not have, even if a future change makes the plan more permissive.

## Exercise 4

```ts
test('4: the clamp hides an over-reserved balance', () => {
  const overReserved = { ...balance, onHand: 5, reserved: 20 }
  assert.equal(availableToPromise(overReserved), 0)
  assert.equal(stockHealth(overReserved), 'stockout')
  assert.throws(() => applyReservation(overReserved, 1), /currently available/)
})
```

The dashboard row reads "stockout", the same as an honest empty shelf. It does not reveal that 15 units were promised that do not exist. Showing raw `onHand` and `reserved` next to `available` (which `listInventory` already returns) is what lets an operator spot it.

## Exercise 5

```ts
export function applyShipment(balance: InventoryBalance, quantity: number): InventoryBalance {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Shipment quantity must be a positive whole number.')
  }

  if (quantity > balance.onHand) {
    throw new Error('Cannot ship more units than are on hand.')
  }

  if (quantity > balance.reserved) {
    throw new Error('Cannot ship more units than are currently reserved.')
  }

  return {
    ...balance,
    onHand: balance.onHand - quantity,
    reserved: balance.reserved - quantity,
  }
}
```

With this version the Exercise 5 check passes and `tests/inventoryRules.test.ts:82` (ship 12 from 42/20, expect 30/8) is unaffected. The guard order matters only for which message you see; all three conditions are independent.

## Exercise 6

`true`, then `false`. `reserveSalesOrder` is safe because it passes only rows `where: { warehouseId: order.warehouseId, … }` (`orders.service.ts:51-56`). To make the helper enforce it, either give `planReservation` a `warehouseId` parameter and match on both fields, or reject input whose balances span more than one warehouse.

## Exercise 7

Before: no header → `authenticateRequest` looks up `user-ops-admin` (`auth.ts:18`, `db.ts:6`), who is seeded as `admin` (`seed.ts:35-38`), so `GET /api/audit-logs` returns 200. `x-user-id: user-buyer` → rank 1 < 3 → 403. A sketch of the change:

```ts
const requestedUserId = request.header('x-user-id')
if (!requestedUserId) {
  _response.status(401).json({ error: 'Missing x-user-id' })
  return
}
const actor = await prisma.user.findFirst({ where: { id: requestedUserId, tenantId: defaultTenantId } })
if (!actor) {
  _response.status(401).json({ error: 'Unknown user' })
  return
}
```

(rename `_response` to `response` since it is now used; `noUnusedParameters` is on in `tsconfig.json`). Then add `.set('x-user-id', 'user-ops-admin')` to the CSV request in `tests/api.test.ts` and `.set('x-user-id', 'user-warehouse-lead')` to both reserve requests in `tests/reservation-api.test.ts`. The dashboard request also needs a header, since `authenticateRequest` runs on every route after `/api/health`. The browser client (`src/client/api.ts`) sends no header at all, so it would need one too; that is the real cost of the fix and why it should come with a login story rather than a hard-coded id.

## Exercise 8

Success path, all inside `db.$transaction` (`orders.service.ts:37`):

1. Per SKU: `inventoryItem.update` with `reserved: { increment }` (`:95`) and one active `StockReservation` (`:99`) holding the summed quantity, after `applyReservation` re-checks it (`:93`).
2. `SalesOrder.status` → `allocated` (`:112`).
3. `DomainEvent` `order.reserved` (`:116`).
4. Pending `OutboxMessage` to `notifications.order_updates` (`:126`).
5. Success `AuditLog` `order.reserved` with `lineCount` (`:135`).

Refusal path: one `AuditLog` `order.reservation_failed` with the failures (`:60`), then a normal return, so it commits. "Rejection changes no tables" would be a wrong review claim. The not-found and already-processed paths (`:43-49`) write nothing.

A complete note: "The service plans against warehouse-scoped balances, then writes per SKU with `applyReservation` as a second guard, so 14 + 9 against 22 is refused and a fitting order produces one reservation row per SKU. The transaction makes stock, status, event, outbox and audit commit together. Both guards compare against balances read at the start of the transaction and the increment is unconditional, so protection against two concurrent reservations rests on the database's isolation, not on this code. Both audit rows name `systemUserId`, not the caller. `tests/reservation-api.test.ts` covers refusal and per-SKU success against a real SQLite file but not concurrency."

## Senior review findings

Checked against the code on 2026-10-06. Severity is for a production deployment of this code, not for the demo.

**F1. A missing `x-user-id` header authenticates as the admin (high).** `auth.ts:18` falls back to `systemUserId`, which is `'user-ops-admin'` (`db.ts:6`), seeded with `role: 'admin'` (`seed.ts:35-38`). Any request without the header passes every `requireRole` check. The header is also the whole identity: there is no credential, so sending `x-user-id: user-ops-admin` works too. The browser client never sends the header (`src/client/api.ts:14`), so the UI only works because of the fallback, and so do `tests/api.test.ts:24` and both reserve requests in `tests/reservation-api.test.ts`. Fix: Exercise 7, plus real authentication before anything leaves localhost.

**F2. `requireRole` checks a minimum rank, not the listed roles (medium, latent).** `auth.ts:33` takes `Math.min` of the listed roles' ranks. For the CSV export, `['buyer', 'warehouse_manager', 'admin']` (`app.ts:93`) gives a minimum of 1, so `warehouse_associate` (rank 1, `auth.ts:8`) is allowed though not listed, and the 403 body's `requiredRoles` misdescribes the rule. No seeded user has that role, so it is latent. Fix: check `allowedRoles.includes(actor.role)`, or rename the API to `requireMinimumRole('buyer')` so the code says what it does.

**F3. The over-reservation guard is check-then-act (medium, database-dependent).** The balances are read at `orders.service.ts:51`, both guards compare against that read, and the write at `:95-98` is an unconditional `increment`. The status guard at `:47` and the update at `:112` (`where: { id }` only) have the same shape, so a double-clicked reserve could in principle allocate one order twice. On SQLite, writers are serialized, so a stale-read double increment is not expected there; the plausible worst case is a busy/locked error on the losing request. Nothing in the suite demonstrates either outcome. Port this code to PostgreSQL at its default READ COMMITTED isolation and both transactions can pass the check and both increments land. Fix: make the write conditional and check the affected-row count, for example `updateMany({ where: { id: order.id, status: 'pending_reservation' }, … })` for the order, and a raw `UPDATE "InventoryItem" SET reserved = reserved + $1 WHERE id = $2 AND "onHand" - reserved >= $1` for stock; roll back if either returns 0.

**F4. Reservation audit rows name the wrong actor (medium).** Both audit writes use `actorId: systemUserId` (`orders.service.ts:64`, `:139`). The route has `request.actor` (set at `auth.ts:28`) but calls `reserveSalesOrder(prisma, params.orderId)` without it (`app.ts:55`). Every reservation, by anyone, is recorded as Renee the ops admin. Fix: pass the actor id into the service and write it.

**F5. `applyShipment` accepts corrupting quantities (low, latent).** `inventoryRules.ts:98-108` only checks `quantity > reserved`. Observed: `applyShipment(balance, -5)` returns `onHand: 47, reserved: 25`; `1.5` returns `40.5 / 18.5`; shipping 10 from `onHand: 5, reserved: 20` returns `onHand: -5`. No server code calls it yet (only `tests/inventoryRules.test.ts`), so this is the moment to fix it, before a shipping endpoint does. Fix: Exercise 5.

**F6. An unknown user id returns 500, not 401 (low).** `auth.ts:24` calls `next(new Error(...))`; the error handler (`app.ts:111-118`) logs it and returns `500 Internal server error`. A client cannot tell "you are not a user" from "the server broke", and the log fills with stack traces for bad input.

**F7. Low-stock reconciliation repeats the `Date.now()` id pattern (low).** `07` explains why the order service moved to `randomUUID()`. `reconciliation.service.ts` still uses `note-low-stock-${inventoryItemId}-${Date.now()}` (`:25`) and `audit-reconciliation-${Date.now()}` (`:38`); two runs in the same millisecond (the worker script plus `POST /api/worker/reconcile`) collide on the audit primary key. Its de-duplication is also check-then-act: `findFirst` (`:10`) then `create` (`:23`), with no unique constraint on `Notification`, so concurrent runs can both notify. Notifications always go to the hard-coded `'user-buyer'` (`:27`).

**F8. Reserve responses blur outcomes (low, design).** A non-pending order returns `ok: true` with its current status and writes nothing (`orders.service.ts:47-48`), so the UI's "is now allocated" message (`App.tsx:79`) cannot tell "I just did it" from "it was already done". A missing order returns HTTP 200 with `status: 'not_found'` (`:44`), which the UI shows as "could not reserve: unknown failure" because `failures` is empty. A 404 and an explicit `alreadyProcessed` flag would say what happened.
