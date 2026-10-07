# 05: progressive practice

Exercises 1-6 run with no install. Create a scratch folder `practice-checks/` at the project root (it is outside the `tsconfig.json` include list, and a `.check.ts` name is outside Vitest's default `*.test.ts` pattern, so neither tool picks it up). Each exercise adds one `test(...)` to `practice-checks/inventory.check.ts`, which starts with:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyReservation,
  applyShipment,
  availableToPromise,
  planReservation,
  stockHealth,
} from '../src/shared/inventoryRules.ts'

const balance = { skuId: 'sku-pack-green', warehouseId: 'wh-west', onHand: 42, reserved: 20, reorderPoint: 50, safetyStock: 28 }
```

Run it from the project root with:

```text
node --experimental-strip-types --test practice-checks/inventory.check.ts
```

(Node 22.6+; the flag is optional on 22.18+ / 23.6+.) Write your prediction before each run. Exercises 7 and 8 need the full install or are review writing. Delete `practice-checks/` when you finish; it is not part of the project.

## Exercise 1: duplicate lines compete for one stock pool

**Goal:** pin the bug this course is about. Write a test asserting that lines of 14 and 9 for `sku-pack-green` produce exactly one failure, with `requested: 23`, `available: 22` and the reason string from `inventoryRules.ts:71`, and that a single line of 18 still returns `{ ok: true, failures: [] }`. Then copy `snapshots/inventoryRules-before.ts.txt` to `practice-checks/before.ts`, point the import at it, and predict what changes.

**Check:** passes against the current file. Against `before.ts`, the 14 + 9 assertion fails because the old code returns `{ ok: true, failures: [] }`.

## Exercise 2: invalid quantities are reported, never aggregated, never applied

**Goal:** for each of `0, -1, 1.5, Infinity, NaN, 2 ** 53`, call `planReservation` with that line plus a valid line of 5 for the same SKU. Assert exactly one failure, `available: 0`, a reason matching `/positive whole number/`, and that `applyReservation(balance, quantity)` throws the same message. Finish with `applyReservation(balance, 23)` throwing `/currently available/`.

**Check:** passes. If you see two failures for one quantity, the invalid line leaked into `requestedBySku`. `NaN` and `2 ** 53` are not in the Vitest suite, so this check covers more than the delivered tests do.

## Exercise 3: a SKU never stocked in this warehouse

**Goal:** a valid quantity for `sku-never-stocked` against `[balance]`. Assert the full failure object: `requested: 1`, `available: 0`, reason `No inventory balance exists for this SKU in the selected warehouse.`

**Check:** passes. Then read `orders.service.ts:84-91` and write one sentence on why the `if (!balance) continue` guard stays even though the plan already fails first.

## Exercise 4: the clamp hides an over-reserved balance

**Goal:** with `{ ...balance, onHand: 5, reserved: 20 }`, predict `availableToPromise`, `stockHealth` and `applyReservation(…, 1)` before running. Assert them.

**Check:** passes with `0`, `'stockout'`, and a throw matching `/currently available/`. In a comment, explain what an operator looking at the dashboard would and would not learn from this row.

## Exercise 5: close the `applyShipment` gap (red, then green)

**Goal:** `applyShipment` (`inventoryRules.ts:98-108`) checks only `quantity > balance.reserved`. Write the check first:

```ts
test('5: applyShipment rejects quantities that would corrupt the balance', () => {
  for (const quantity of [0, -5, 1.5]) {
    assert.throws(() => applyShipment(balance, quantity), /positive whole number/, `quantity ${quantity}`)
  }
  assert.throws(() => applyShipment({ ...balance, onHand: 5, reserved: 20 }, 10), /on hand/)
  assert.deepEqual(applyShipment(balance, 12), { ...balance, onHand: 30, reserved: 8 })
})
```

Run it and record the first failure. Then add guards to `applyShipment` until it passes, without breaking `tests/inventoryRules.test.ts:82`.

**Check:** before your change the run reports `not ok` with `Missing expected exception: quantity 0` (today `applyShipment(balance, -5)` returns `onHand: 47, reserved: 25`, and shipping 10 from 5 on hand returns `onHand: -5`). After your change all tests pass.

## Exercise 6: `planReservation` trusts the caller's warehouse

**Goal:** add `east = { ...balance, warehouseId: 'wh-east', onHand: 0, reserved: 0 }`. Predict `planReservation([{ skuId: balance.skuId, quantity: 5 }], [balance, east]).ok`, then the same with `[east, balance]`.

**Check:** `true`, then `false`: `balances.find` matches on `skuId` only (`inventoryRules.ts:51`), so the first row wins. Write down which line of `orders.service.ts` makes this safe today, and one way to make the helper enforce it itself.

## Exercise 7: who is the caller when no one says? (needs `npm ci` + seeded DB)

**Goal:** read `src/server/modules/platform/auth.ts:18`, `src/server/db.ts:6` and `prisma/seed.ts:35-38`. Predict the status of `GET /api/audit-logs` (admin only) sent with no `x-user-id` header, and with `x-user-id: user-buyer`. Then change `authenticateRequest` so a missing or unknown header returns 401 instead of falling back, and update the tests that relied on the fallback.

**Check:** before the change, a supertest request with no header gets 200 and `user-buyer` gets 403. After it, no header gets 401, `user-buyer` still gets 403, and `tests/api.test.ts` and `tests/reservation-api.test.ts` pass again only once their privileged requests send `.set('x-user-id', 'user-ops-admin')` (or `user-warehouse-lead` for reserve).

## Exercise 8: review the transaction boundary

**Goal:** read `reserveSalesOrder` (`orders.service.ts:36-149`) and list every record written on the success path and on the refusal path, with line numbers. Then write a five-sentence review note: what the transaction guarantees, what `applyReservation` at `:93` adds, what neither guarantees under concurrency, and who the audit rows name as the actor.

**Check:** compare with the Exercise 8 answer in `06-SOLUTIONS-AND-REVIEW.md`. A complete list has five success-path write kinds and one refusal-path write.
