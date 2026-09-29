# 03: worked change, before and after

The pre-change planner in `astraupskill/snapshots/inventoryRules-before.ts.txt` used `lines.flatMap`. For every line it found one balance and compared that line's quantity to the same `available` number. That code was concise and correct for orders with one line per SKU, which explains why the existing tests passed. It was incorrect for repeated SKU lines. The pre-change `applyReservation` simply returned `{ ...balance, reserved: balance.reserved + quantity }`, so a caller could pass `-3` or `23` and create an impossible state.

The implementation now builds a `Map<string, number>` named `requestedBySku`. Each valid line adds to the current total. Invalid lines are collected separately and produce a failure with the exact reason `Reservation quantity must be a positive whole number.` The grouped totals are then compared with the matching balance. For the example balance `{ skuId: 'sku-pack-green', onHand: 42, reserved: 20 }`, lines 14 and 9 become one request for 23; available is 22, so the decision is `{ ok: false }` with `requested: 23` and `available: 22`. A single line of 18 still returns success, preserving the original behavior.

The complete shape is already in `src/shared/inventoryRules.ts`, so the following small program can be run with `npx tsx` after dependencies are installed:

```ts
import { planReservation } from './src/shared/inventoryRules.ts'

const balance = { skuId: 'sku-pack-green', warehouseId: 'wh-west', onHand: 42, reserved: 20, reorderPoint: 50, safetyStock: 28 }
console.log(planReservation([
  { skuId: 'sku-pack-green', quantity: 14 },
  { skuId: 'sku-pack-green', quantity: 9 },
], [balance]))
```

The expected output has `ok: false`, one failure, `requested: 23`, and `available: 22`. Notice what the patch does not change: the Prisma schema, order status names, event names, or transaction sequence. A bounded maintenance patch is easier to review because the new behavior has one clear reason and the old workflows remain recognizable.
