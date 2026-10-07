# 03: worked change, before and after

## Part 1: the planner (`src/shared/inventoryRules.ts`)

The pre-change planner in `astraupskill/snapshots/inventoryRules-before.ts.txt` used `lines.flatMap`. For every line it found one balance and compared that line's quantity to the same `available` number. That code was correct for orders with one line per SKU, which explains why the existing tests passed. It was incorrect for repeated SKU lines. The pre-change `applyReservation` simply returned `{ ...balance, reserved: balance.reserved + quantity }`, so a caller could pass `-3` or `23` and create an impossible state.

The implementation now builds a `Map<string, number>` named `requestedBySku` (`inventoryRules.ts:33`). Each valid line adds to the current total. Invalid lines are collected separately (`:34-41`) and produce a failure with the exact reason `Reservation quantity must be a positive whole number.` The grouped totals are then compared with the matching balance (`:50-77`). For the example balance `{ skuId: 'sku-pack-green', onHand: 42, reserved: 20 }`, lines 14 and 9 become one request for 23; available is 22, so the decision is `{ ok: false }` with `requested: 23` and `available: 22`. A single line of 18 still returns success, preserving the original behavior.

You can run this without installing anything. Save the following as `practice-checks/demo.ts` (a scratch folder outside the `tsconfig.json` include list and outside Vitest's `*.test.ts` pattern) and run `node --experimental-strip-types practice-checks/demo.ts` from the project root:

```ts
import { planReservation } from '../src/shared/inventoryRules.ts'

const balance = { skuId: 'sku-pack-green', warehouseId: 'wh-west', onHand: 42, reserved: 20, reorderPoint: 50, safetyStock: 28 }
console.log(planReservation([
  { skuId: 'sku-pack-green', quantity: 14 },
  { skuId: 'sku-pack-green', quantity: 9 },
], [balance]))
```

Observed output on Node 22.16 (after an `ExperimentalWarning` on stderr):

```text
{
  ok: false,
  failures: [
    {
      skuId: 'sku-pack-green',
      requested: 23,
      available: 22,
      reason: 'Requested quantity exceeds available-to-promise inventory.'
    }
  ]
}
```

## Part 2: the write loop (`src/server/modules/orders/orders.service.ts`)

Fixing only the planner left the service writing per line. The earlier loop (no snapshot was kept; its id format is quoted in `07`) iterated `order.lines`, incrementing `reserved` and creating a `StockReservation` for each line, with ids built from `Date.now()`. The current loop, `orders.service.ts:75-110`, is:

```ts
    const requestedBySku = new Map<string, number>()
    for (const line of order.lines) {
      requestedBySku.set(line.skuId, (requestedBySku.get(line.skuId) ?? 0) + line.quantity)
    }

    for (const [skuId, quantity] of requestedBySku) {
      const balance = balances.find((item) => item.skuId === skuId)
      if (!balance) {
        continue
      }
      applyReservation(balance, quantity)

      await tx.inventoryItem.update({
        where: { id: balance.id },
        data: { reserved: { increment: quantity } },
      })
      await tx.stockReservation.create({ data: { id: `res-${randomUUID()}`, /* ... */ quantity, status: 'active' } })
    }
```

(Comments trimmed and the `stockReservation.create` payload shortened; read the file for the full version.) Three things changed: aggregation matches the planner, `applyReservation` re-checks the total at the write so a throw rolls the transaction back, and ids use `randomUUID()`. What did not change: the Prisma schema, the order status names, the event and audit action names, and the order of writes after the loop (status, event, outbox, audit). A bounded maintenance patch is easier to review because each changed line has one clear reason and the old workflow remains recognizable.

`tests/reservation-api.test.ts` is the regression test for Part 2: its second case asserts exactly one `StockReservation` row with `quantity: 2` for an order of two one-unit lines.
