# 01: codebase map and reading order

Atlas Fulfillment is a modular monolith. The browser code in `src/App.tsx` calls helpers in `src/client/api.ts` (and falls back to `src/client/fallbackData.ts` when the API is down). `src/server/app.ts` composes the Express routes; `src/server/index.ts` starts it, and Vite proxies `/api` to `http://127.0.0.1:4000` (`vite.config.ts`). Every route except `/api/health` runs `authenticateRequest` first (`app.ts:26`), and the two write routes plus the audit and CSV-export reads add `requireRole` (`app.ts:52`, `:85`, `:93`, `:103`).

The route for `POST /api/orders/:orderId/reserve` (`app.ts:52`) parses `orderId` with zod and calls `reserveSalesOrder` in `src/server/modules/orders/orders.service.ts`. That service opens a Prisma transaction (`:37`), reads the order and its lines, reads inventory for the order's warehouse (`:51`), invokes `planReservation` (`:57`), and only then writes `InventoryItem`, `StockReservation`, `SalesOrder`, `DomainEvent`, `OutboxMessage`, and `AuditLog` records. The browser therefore sees a result produced by several layers, even though the business decision is a plain shared function.

| layer | files | what to look for |
| --- | --- | --- |
| schema | `prisma/schema.prisma`, `prisma/create-sqlite-schema.ts`, `prisma/seed.ts` | `InventoryItem @@unique([warehouseId, skuId])`; `db:push` runs the hand-written SQL script, not `prisma db push` |
| shared rules | `src/shared/inventoryRules.ts` (126 lines), `src/shared/apiContracts.ts` | pure functions, no imports |
| services | `src/server/modules/*/*.service.ts` | each takes a `PrismaClient` argument; only `orders` writes in a transaction |
| transport | `src/server/app.ts`, `src/server/modules/platform/auth.ts` | header-based actor lookup, rank-based role check |
| worker | `src/worker/reconciliation.worker.ts` → `modules/worker/reconciliation.service.ts` | low-stock notifications; the same service is also exposed as `POST /api/worker/reconcile` |
| tests | `tests/inventoryRules.test.ts`, `tests/api.test.ts`, `tests/reservation-api.test.ts` | pure rules vs seeded-database HTTP tests |

Read `prisma/schema.prisma` first. `SalesOrderLine.quantity` is an `Int`, and `InventoryItem` has one row per `(warehouseId, skuId)` because of its compound unique constraint. That relationship is the key evidence for the bug: repeated order lines still refer to one inventory row. Note that nothing in the schema stops two lines of one order from naming the same SKU. Read `src/shared/inventoryRules.ts` next. `availableToPromise` (`:25`) computes `onHand - reserved` and clamps negative results to zero. `planReservation` (`:29`) decides whether all requested units fit. `applyReservation` (`:83`) is a pure state transformation, while `applyShipment` (`:98`) protects the reserved quantity when shipping (but see finding F5 in `06`).

The tests in `tests/inventoryRules.test.ts` are the fastest Vitest feedback loop: they use an in-memory `balance` object and need no database. `tests/api.test.ts` covers health, dashboard, and CSV routes against the seeded database. `tests/reservation-api.test.ts` is the one that exercises the reservation write path end to end: it creates an order with two lines for `sku-pack-black`, posts to the reserve route, and checks the database afterwards.

A useful reading order is: schema, shared rules, rule tests, order service, reservation API test, route, then client. This moves from invariant to orchestration to transport, and it prevents a common junior mistake: changing a UI quantity check when the server-side rule is the actual protection boundary.

When tracing a future CRUD change, write down the input type, the owner of the invariant, the persistence mutation, and the observable response. For this change those are `ReservationLine[]`, `inventoryRules.ts`, the transaction writes at `orders.service.ts:82-145`, and `ReservationResultDto` in `src/shared/apiContracts.ts`.
