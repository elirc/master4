# 07: trace lab from request to stock state

Start at `src/server/app.ts`. A client sends `POST /api/orders/:orderId/reserve`. `authenticateRequest` (`app.ts:26`) resolves the actor from the `x-user-id` header, falling back to the seeded admin when the header is absent (finding F1 in `06`). `requireRole(['warehouse_manager', 'admin'])` (`app.ts:52`) then compares role ranks. The route parses a non-empty `orderId` with zod and calls `reserveSalesOrder(prisma, orderId)` (`app.ts:55`); it does not pass the actor. The route itself does not calculate stock; that belongs to the order module and the shared rule.

In `src/server/modules/orders/orders.service.ts`, `reserveSalesOrder` opens `db.$transaction` (`:37`) and loads the order with its lines. No order → it returns `status: 'not_found'` (`:44`). Status other than `pending_reservation` → it returns `ok: true` with the current status and writes nothing (`:47-48`). Otherwise it loads `InventoryItem` rows for the order's warehouse and the line SKUs (`:51-56`) and calls `planReservation` (`:57`). For invalid quantity, missing balance, or insufficient stock, it writes one `order.reservation_failed` audit row and returns without touching inventory or order status (`:59-72`).

When the decision succeeds, the service sums lines per SKU (`:77-80`), and for each SKU calls `applyReservation` as a second guard (`:93`), increments that `InventoryItem.reserved` (`:95`) and creates one `StockReservation` (`:99`). It then sets the order to `allocated` (`:112`) and creates a domain event (`:116`), outbox message (`:126`) and audit row (`:135`). The transaction means these writes commit together. The shared helper does not know about HTTP, roles, Prisma, or events; that is a feature, because it can be tested with plain objects (Exercises 1-6) and reused by a worker or import path.

## The lab

Fill in this table for an order with lines 14 and 9 of one SKU against on-hand 42 and reserved 20, then for a single line of 18. Predict every cell before checking against the source lines above.

| boundary | 14 + 9 | 18 |
| --- | --- | --- |
| `order.lines` length | 2 | 1 |
| `requestedBySku` in the planner | `{ sku → 23 }` | `{ sku → 18 }` |
| available | 22 | 22 |
| decision | `ok: false`, one failure 23 vs 22 | `ok: true` |
| HTTP | 200, `{ ok: false, status: 'pending_reservation', failures: [...] }` | 200, `{ ok: true, status: 'allocated', failures: [] }` |
| `reserved` after commit | 20 (unchanged) | 38 |
| new `StockReservation` rows | 0 | 1 |
| new `AuditLog` rows | 1 (`order.reservation_failed`) | 1 (`order.reserved`, `lineCount: 1`) |

Before the fix, the planner returned success for 14 + 9 and the per-line loop attempted two increments (to 34, then 43) with ids that could collide (next section). That is a source trace of the old code, not an observed run. The current behavior for the refusal case and for a fitting two-line order is observed by `tests/reservation-api.test.ts`, which uses `sku-pack-black` and quantities derived from the seeded balance rather than these numbers.

Extension: run the same trace for an order whose status is already `allocated`, and for an order id that does not exist. Write down what the browser message in `src/App.tsx:76-81` would show for each (see F8 in `06`).

## The grouping step your trace passes through

The boundary where 14 and 9 become 23 is `src/shared/inventoryRules.ts:29`. Invalid quantities are separated out in the same pass, so a line with a fractional quantity never contributes to the aggregate it would otherwise inflate.

```ts
export function planReservation(lines: ReservationLine[], balances: InventoryBalance[]): ReservationDecision {
  // An order may contain more than one line for the same SKU (for example,
  // when a UI appends an item instead of merging it).  Check the aggregate
  // demand so every line competes for the same inventory pool.
  const requestedBySku = new Map<string, number>()
  const invalidLines = lines.filter((line) => {
    const valid = Number.isSafeInteger(line.quantity) && line.quantity > 0
    if (!valid) {
      return true
    }
    requestedBySku.set(line.skuId, (requestedBySku.get(line.skuId) ?? 0) + line.quantity)
    return false
  })
```

## Why time-based ids collide

The earlier service built ids like `` `res-${order.id}-${line.skuId}-${Date.now()}` ``. Two lines for the same SKU in one order ran inside one transaction within the same millisecond, so the two ids could be identical and the second insert failed on the primary key; two orders reserved in the same millisecond could produce the same `evt-order-reserved-<ms>`. `Date.now()` has millisecond resolution and no uniqueness guarantee; it is a timestamp, not an identifier. `orders.service.ts` now uses `randomUUID()` from `node:crypto` for every id it generates (`:62`, `:101`, `:118`, `:128`, `:137`). The reconciliation service has not been converted: `reconciliation.service.ts:25` and `:38` still use `Date.now()` (F7 in `06`).

Predict: which of the two order-service collisions could a test have caught? Only the same-order one, with a two-line fixture. The cross-order one needs two requests in the same millisecond, which a test cannot force reliably. That is why the id scheme, not a test, is the guard. (Per-SKU writes now also mean one order never creates two reservation rows for one SKU.)
