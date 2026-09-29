# 07: trace lab from request to stock state

Start at `src/server/app.ts`. A warehouse manager or admin sends `POST /api/orders/:orderId/reserve`. `authenticateRequest` runs first, then `requireRole` checks the role. The route parses the non-empty `orderId` and calls `reserveSalesOrder(prisma, orderId)`. The route itself does not calculate stock; that belongs to the order module and the shared rule.

In `src/server/modules/orders/orders.service.ts`, `reserveSalesOrder` opens `db.$transaction`. It loads the order with its lines. If no order exists, it returns `not_found`. If the status is already beyond `pending_reservation`, it returns the current status without repeating work. Otherwise it loads inventory rows for the order warehouse and the line SKUs. The changed `planReservation` is called with those lines and balances. For duplicate lines, the helper groups demand before returning. For invalid quantity or insufficient stock, the service writes a failed reservation audit record and returns without updating inventory or order status.

When the decision succeeds, the service loops over order lines and increments each inventory row's `reserved` value, creates a `StockReservation`, changes the order to `allocated`, then creates a domain event, outbox message, and audit log. The transaction means these writes commit together. The shared helper does not know about HTTP, roles, Prisma, or events; that is a feature. It can be tested with ordinary objects and can be reused by a worker or import path.

For the lab, write down the values at each boundary for an order containing two lines of 14 and 9 against on-hand 42 and reserved 20. Before the fix, planning returns success and the service attempts two increments. If that transaction completes, its arithmetic would leave reserved at 43; this is a source trace, not an observed reservation API test. After the fix, planning returns one failure for 23 versus 22. The service returns HTTP 200 with `ok: false`, the unchanged order status and the failure details, and its transaction can commit the failure audit. It does not perform the allocation writes. Then repeat with one line of 18: planning permits allocation, which would leave reserved at 38 if the service transaction succeeds. The pure tests establish the decision; a disposable persistence test would be needed to prove the complete write sequence experimentally.

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

The delivered service built ids like `` `res-${order.id}-${line.skuId}-${Date.now()}` ``. Two lines for the same SKU in one order run inside one transaction within the same millisecond, so the two ids were identical and the second insert failed on the primary key; and two orders reserved in the same millisecond produced the same `evt-order-reserved-<ms>`. `Date.now()` has millisecond resolution and no uniqueness guarantee; it is a timestamp, not an identifier. The fix pass uses `crypto.randomUUID()` (122 random bits) for every generated id. Keep a readable prefix if it helps debugging, but never let the uniqueness depend on the clock. Predict: which of the two collisions would the suite have caught before the fix? (Only the same-order one, and only with a two-line fixture; the cross-order one needs two requests in the same millisecond, which a test cannot force reliably. That is why the id scheme, not a test, is the guard.)

