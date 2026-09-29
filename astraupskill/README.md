# Atlas Fulfillment: inventory reservation learning path

This course is a guided code reading and maintenance exercise for Atlas Fulfillment, a TypeScript modular monolith. The concrete change in this batch lives in `src/shared/inventoryRules.ts`: reservation planning now sums repeated SKU lines before comparing demand with available-to-promise stock, and reservation application rejects invalid or unavailable quantities. The rule is small, but it protects a business invariant that affects order allocation, warehouse work, and every future caller of the shared helper.

Start with this file to learn the route through the course. Read `01-CODEBASE-MAP.md` to identify the browser, API, service, shared rule, and Prisma layers. Then read `02-CONCEPTS.md` for the inventory vocabulary and the reason duplicate lines are one demand pool. `03-WORKED-CHANGE.md` shows the original implementation, the changed implementation, and a complete runnable example. `04-TESTING-AND-DEBUGGING.md` explains how the Vitest tests expose the regression and how to investigate failures without guessing. Work through `05-PRACTICE.md` before opening `06-SOLUTIONS-AND-REVIEW.md`. Finally, `07-TRACE-LAB.md` asks you to follow a reservation from HTTP to database writes, while `VERIFICATION.md` records the commands and evidence for this batch.

The intended learner is a junior developer moving toward mid-level CRUD work. You should already recognize functions, arrays, objects, and basic TypeScript. Every lesson names files that exist in this repository and uses the actual domain terms `onHand`, `reserved`, `availableToPromise`, `SalesOrderLine`, and `StockReservation`. The exercises are deliberately bounded: they do not ask you to invent authentication, remote sync, or a new persistence architecture. Run examples from the project root after `npm ci`; domain-only tests do not require a production service.

Keep the snapshot at `astraupskill/snapshots/inventoryRules-before.ts.txt` beside the lessons. It is the exact pre-change source and lets you compare behavior rather than relying on memory. When reviewing your work, ask whether an order with two lines for `sku-pack-green` can reserve more units than the one `InventoryBalance` makes available, whether invalid quantities fail clearly, and whether the existing single-line behavior remains intact.

## Prerequisites and glossary

**Prerequisites:** TypeScript arrays and objects with `map`/`filter`; HTTP routes and JSON bodies; enough Prisma to read a model and a `$transaction`. The `master3` course here is a natural predecessor for tenant scope, audit and outbox.

| term | meaning | where in this project |
| --- | --- | --- |
| on hand | the physical count of units in a warehouse for one SKU | `onHand` in `src/shared/inventoryRules.ts`, `model InventoryItem` in `prisma/schema.prisma` |
| reserved | units already promised, so no longer free to promise | `reserved` on `InventoryBalance` in `src/shared/inventoryRules.ts` |
| available to promise | the derived number a new order may claim, never negative | `availableToPromise` in `src/shared/inventoryRules.ts` |
| demand pool | every line for one SKU competing for the same stock | the `requestedBySku` map in `planReservation` in `src/shared/inventoryRules.ts` |
| reservation plan | the pure decision, taken before any write | `planReservation(lines, balances)` in `src/shared/inventoryRules.ts` |
| failure reason | the per-SKU explanation carried back with requested and available | the `failures` array in `planReservation` |
| apply reservation | the guarded transition incrementing `reserved` only when valid | `applyReservation(balance, quantity)` in `src/shared/inventoryRules.ts` |
| order status transition | the move from `pending_reservation` to `allocated`, refused otherwise | the status guard and update in `src/server/modules/orders/orders.service.ts` |
| stock reservation row | the durable link between an order line and the units held | `model StockReservation` in `prisma/schema.prisma` |
| balance key | the pair identifying one inventory balance | `@@unique([warehouseId, skuId])` on `model InventoryItem` in `prisma/schema.prisma` |
| transaction boundary | stock, status, audit and outbox all commit or none do | `db.$transaction` in `reserveSalesOrder` in `orders.service.ts` |
| outbox message | the intent to publish, written with the change instead of sent | `tx.outboxMessage.create` in `reserveSalesOrder`, `model OutboxMessage` in `prisma/schema.prisma` |

