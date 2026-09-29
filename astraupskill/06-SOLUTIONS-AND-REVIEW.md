# 06: complete solutions and review notes

The examples below match the four exercises in [05-PRACTICE.md](05-PRACTICE.md). They are worked answers for study; the delivered regression suite remains `tests/inventoryRules.test.ts`. The test snippets can be pasted inside its existing `describe('inventory domain rules', ...)` block. That file already imports `expect`, `it`, `planReservation` and `applyReservation`, and defines this fixture:

```ts
const balance = {
  skuId: 'sku-pack-green',
  warehouseId: 'wh-west',
  onHand: 42,
  reserved: 20,
  reorderPoint: 50,
  safetyStock: 28,
}
```

## Exercise 5 answer

The plan is the guard: `planReservation` reports the missing balance as a failure with `available: 0` and the service returns before writing. The test proves three absences (no reserved change, no reservation row, no new balance row) and one presence (the failure audit row). The `continue` in the loop stays because the loop must never write against a `balance` it does not have, even if a future change makes the plan more permissive; a guard that is unreachable today is still the right shape for the code path.

## Exercise 1: reproduce the oversell

```ts
it('practice: compares duplicate demand with one stock pool', () => {
  const decision = planReservation([
    { skuId: balance.skuId, quantity: 14 },
    { skuId: balance.skuId, quantity: 9 },
  ], [balance])

  // Both lines fit separately, but 14 + 9 exceeds the same 22 units.
  expect(decision.ok).toBe(false)
  expect(decision.failures).toHaveLength(1)
  expect(decision.failures[0]).toEqual({
    skuId: balance.skuId,
    requested: 23,
    available: 22,
    reason: 'Requested quantity exceeds available-to-promise inventory.',
  })
})
```

The original snapshot computes `14 > 22` and `9 > 22`, both false, and returns `{ ok: true, failures: [] }`. The first assertion therefore exposes the old defect. The delivered planner instead accumulates `requestedBySku`: after the first line it contains 14, after the second it contains 23. It compares that one total with 22 and returns the failure above. This is a behavioral assertion; it does not require the implementation to use a particular collection type. Historical reproduction belongs in a disposable learning copy of the original code, rather than replacing the delivered fixed file.

## Exercise 2: report invalid inputs without throwing

```ts
it('practice: rejects each invalid quantity before aggregation', () => {
  const quantities = [0, -1, 1.5, Number.POSITIVE_INFINITY]
  for (const quantity of quantities) {
    let decision: ReturnType<typeof planReservation> | undefined
    expect(() => {
      decision = planReservation([
        { skuId: balance.skuId, quantity },
        { skuId: balance.skuId, quantity: 5 },
      ], [balance])
    }).not.toThrow()

    expect(decision).toEqual({
      ok: false,
      failures: [{
        skuId: balance.skuId,
        requested: quantity,
        available: 0,
        reason: 'Reservation quantity must be a positive whole number.',
      }],
    })
  }
})
```

`Number.isSafeInteger(line.quantity) && line.quantity > 0` defines valid demand. Invalid lines keep their own SKU and requested quantity in the result, but never enter the grouped demand map. The valid quantity 5 in each example fits the stock pool and produces no additional failure. `available: 0` in an invalid-input failure is the helper's validation placeholder; it is not an inventory reading. Checking the complete result prevents a missing-balance error or a second, spurious availability error from passing as correct validation. The guard also rejects `NaN` and unsafe integers, although these additional values are not part of the four-case delivered test.

## Exercise 3: protect the pure state transformation

This is the complete replacement for `applyReservation` in `src/shared/inventoryRules.ts`. It uses the existing `InventoryBalance` type and `availableToPromise` function from that file:

```ts
export function applyReservation(
  balance: InventoryBalance,
  quantity: number,
): InventoryBalance {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Reservation quantity must be a positive whole number.')
  }
  if (quantity > availableToPromise(balance)) {
    throw new Error('Cannot reserve more units than are currently available.')
  }
  return { ...balance, reserved: balance.reserved + quantity }
}
```

The matched tests are:

```ts
it('practice: protects direct reservation and preserves its input', () => {
  const before = { ...balance }
  expect(() => applyReservation(balance, 0))
    .toThrow('Reservation quantity must be a positive whole number.')
  expect(() => applyReservation(balance, 23))
    .toThrow('Cannot reserve more units than are currently available.')
  expect(balance).toEqual(before)

  const updated = applyReservation(balance, 5)
  expect(updated).toEqual({ ...before, reserved: 25 })
  expect(updated).not.toBe(balance)
  expect(balance).toEqual(before)
})
```

The planner returns a decision that a caller can display or audit. This helper promises a new valid balance; throwing prevents it from returning a result for an invalid operation. Neither helper writes to a database. In the current application, `reserveSalesOrder` uses `planReservation` and performs Prisma increments itself; it does not call `applyReservation`. The added guards protect direct helper callers, while aggregation reaches the real service through the planner.

## Exercise 4: identify the transaction boundary

The successful branch in `src/server/modules/orders/orders.service.ts` performs these writes inside the existing `db.$transaction` callback:

1. For every order line, increment the matching `InventoryItem.reserved` and create an active `StockReservation` with that line's quantity.
2. Update the `SalesOrder.status` to `allocated`.
3. Create the `DomainEvent` named `order.reserved`.
4. Create its pending `OutboxMessage` for `notifications.order_updates`.
5. Create the success `AuditLog` named `order.reserved`, recording the line count.

These writes are unchanged by this patch. They commit together if the transaction succeeds; an exception during them rolls back the transaction. The helper only decides whether the requested quantities fit the supplied balances. It does not persist stock, send a notification, or prove concurrency safety across competing transactions.

The failed-decision branch is different: it creates an `AuditLog` named `order.reservation_failed` and returns the failure result. Because it returns normally, that audit can commit. Inventory quantities and order status remain unchanged, and no reservation, success event or outbox message is created by that branch. Thus “rejection changes no tables” would be an incorrect review claim.

A complete review note is: “The order service passes warehouse-scoped balances to the shared planner before its allocation writes. Aggregating the two SKU lines changes the 14 + 9 request from accepted to rejected against 22 available. The existing transaction still owns persistence and preserves a failure audit. The new tests prove the pure decision and helper behavior; the existing API tests cover health, dashboard reads and CSV export, not reservation persistence or competing reservations.”

Run pasted exercises with `npm test -- --run tests/inventoryRules.test.ts` from the project root. They require no database. The snippets are additional worked examples, so adding them changes the local test count; use the separate verification record for the delivered suite's observed counts.
