# Atlas Fulfillment: inventory reservation learning path

This course is a guided code reading and maintenance exercise for Atlas Fulfillment, a TypeScript modular monolith (Express 5 + Prisma 6 over SQLite, React 19 + Vite, Vitest + supertest; see `package.json`). The concrete change it studies has two halves. In `src/shared/inventoryRules.ts`, reservation planning sums repeated SKU lines before comparing demand with available-to-promise stock, and `applyReservation` rejects invalid or unavailable quantities. In `src/server/modules/orders/orders.service.ts`, the write loop reserves once per SKU (not once per line) and calls `applyReservation` again at the write, so the pure rule guards the transaction and not only the plan. The rule is small, but it protects a business invariant that affects order allocation, warehouse work, and every future caller of the shared helper.

Read `01-CODEBASE-MAP.md` to identify the browser, API, service, shared rule, and Prisma layers. Then read `02-CONCEPTS.md` for the inventory vocabulary and the reason duplicate lines are one demand pool. `03-WORKED-CHANGE.md` shows the original implementation, the changed implementation, and a runnable example. `04-TESTING-AND-DEBUGGING.md` explains the three test files and how to investigate failures without guessing. Work through `05-PRACTICE.md` before opening `06-SOLUTIONS-AND-REVIEW.md`, which also holds the senior review findings. Finally, `07-TRACE-LAB.md` follows a reservation from HTTP to database writes, while `VERIFICATION.md` records the commands and evidence.

The intended learner is a junior developer moving toward mid-level CRUD work. You should already recognize functions, arrays, objects, and basic TypeScript. Every lesson names files that exist in this repository and uses the actual domain terms `onHand`, `reserved`, `availableToPromise`, `SalesOrderLine`, and `StockReservation`.

There are two ways to run code in this course:

- **No install (Node 22.6 or newer):** the practice checks in `05-PRACTICE.md` import `src/shared/inventoryRules.ts` directly with `node --experimental-strip-types --test`. That file has no imports and only erasable TypeScript, so nothing needs installing. On Node 22.18+ or 23.6+ the flag is optional.
- **Full suite:** `npm ci`, then the database steps in `VERIFICATION.md`, then `npm test`. Two of the three Vitest files need a generated Prisma client and a seeded SQLite database.

Keep the snapshot at `astraupskill/snapshots/inventoryRules-before.ts.txt` beside the lessons. It is the pre-change `src/shared/inventoryRules.ts`; there is no snapshot of the pre-change order service, so the old write loop is described in prose in `03` and `07`. When reviewing your work, ask whether an order with two lines for `sku-pack-green` can reserve more units than the one `InventoryBalance` makes available, whether invalid quantities fail clearly, and whether the existing single-line behavior remains intact.

## Prerequisites and glossary

**Prerequisites:** TypeScript arrays and objects with `map`/`filter`; HTTP routes and JSON bodies; enough Prisma to read a model and a `$transaction`.

| term | meaning | where in this project |
| --- | --- | --- |
| on hand | the physical count of units in a warehouse for one SKU | `onHand` in `src/shared/inventoryRules.ts`, `model InventoryItem` in `prisma/schema.prisma` |
| reserved | units already promised, so no longer free to promise | `reserved` on `InventoryBalance` in `src/shared/inventoryRules.ts` |
| available to promise | the derived number a new order may claim, never negative | `availableToPromise` in `src/shared/inventoryRules.ts:25` |
| demand pool | every line for one SKU competing for the same stock | the `requestedBySku` map in `planReservation` (`inventoryRules.ts:33`) and again in `orders.service.ts:77` |
| reservation plan | the pure decision, taken before any write | `planReservation(lines, balances)` in `src/shared/inventoryRules.ts:29` |
| failure reason | the per-SKU explanation carried back with requested and available | the `failures` array in `planReservation` |
| apply reservation | the guarded transition incrementing `reserved` only when valid | `applyReservation(balance, quantity)` in `src/shared/inventoryRules.ts:83`, called at `orders.service.ts:93` |
| order status transition | the move from `pending_reservation` to `allocated`, skipped otherwise | the status guard (`orders.service.ts:47`) and update (`orders.service.ts:112`) |
| stock reservation row | the durable link between an order and the units held, one per SKU | `model StockReservation` in `prisma/schema.prisma` |
| balance key | the pair identifying one inventory balance | `@@unique([warehouseId, skuId])` on `model InventoryItem` in `prisma/schema.prisma` |
| transaction boundary | stock, status, event, outbox and audit all commit or none do | `db.$transaction` in `reserveSalesOrder`, `orders.service.ts:37` |
| outbox message | the intent to publish, written with the change instead of sent | `tx.outboxMessage.create` at `orders.service.ts:126`, `model OutboxMessage` in `prisma/schema.prisma` |
