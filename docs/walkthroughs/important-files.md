# Important File Walkthroughs

These walkthrough notes cover the files that carry the most architectural weight in the initial system.

## `prisma/schema.prisma`

Defines the relational shape of the business. Read this first when learning the project because it names the core entities: tenant, user, warehouse, supplier, product, SKU, inventory item, sales order, reservation, purchase order, shipment, return, audit log, domain event, outbox message, and notification.

Senior-level concept: the schema separates `onHand` from `reserved`. That is the heart of inventory availability. Orders reserve stock before shipment; shipment then reduces both reserved and on-hand.

## `prisma/seed.ts`

Creates realistic data for one tenant. This file is a teaching tool: it shows how products, SKUs, warehouses, inventory balances, sales orders, purchase orders, shipments, returns, domain events, and audit logs relate in practice.

Read it after the schema so the abstract model becomes concrete.

## `src/shared/inventoryRules.ts`

Contains pure business rules. It has no database, HTTP, or React dependency. That makes it easy to test and safe to reuse from multiple backend modules.

Important sections:

- `availableToPromise` defines available stock.
- `planReservation` explains why a reservation can or cannot happen.
- `applyShipment` protects against shipping more than was reserved.
- `isLowStock` centralizes alert behavior.

Senior-level concept: business invariants should be expressed in small, testable units. If inventory math appears in five controllers, the system will eventually drift.

## `src/server/modules/orders/orders.service.ts`

Owns sales-order reservation behavior. This is one of the most important files because it changes inventory, order state, reservations, audit logs, domain events, and outbox messages in one transaction.

Read the transaction carefully. The lesson is that real business workflows often touch several tables, and they must either complete together or fail together.

## `src/server/modules/inventory/inventory.service.ts`

Builds inventory read models for the API and exports. It pulls together SKU, product, warehouse, and balance data.

Senior-level concept: read models are allowed to be shaped for UI/reporting needs, but they should still reuse shared business rules like `availableToPromise` and `stockHealth`.

## `src/server/app.ts`

Composes the Express app. It is intentionally thin: route definitions call module services rather than holding business logic directly.

Important sections:

- `GET /api/health` is public.
- `authenticateRequest` runs before operational API routes.
- Mutating routes use `requireRole`.
- Error handling normalizes validation and unexpected failures.

## `src/server/modules/platform/auth.ts`

Implements the first authentication and authorization shell. It uses seeded users and `x-user-id` for local learning.

Senior-level concept: frontend permission checks are user experience, not security. Backend route guards are the source of truth.

## `src/server/modules/worker/reconciliation.service.ts`

Represents background job behavior. It scans low-stock conditions and creates notifications only when needed.

This teaches idempotency: workers should avoid creating duplicate notifications every time they run.

## `src/App.tsx`

Composes the operations UI. It keeps view state locally and calls API client functions. The file is larger than a final production screen would be, but it still separates dashboard, inventory, orders, purchasing, fulfillment, and admin views into components.

Read it from top to bottom by workflow:

1. Data loading and refresh
2. Navigation
3. Dashboard
4. Inventory filtering
5. Order reservation
6. Admin audit/export tools

## `src/client/api.ts`

Centralizes frontend HTTP calls. As the app grows, this is where typed API clients, request headers, retries, and error normalization should live.

## `tests/inventoryRules.test.ts`

Tests the riskiest pure business rules. This test file is more important than a snapshot test because it protects real inventory behavior.

## `tests/api.test.ts`

Smoke-tests the API surface. These are not enough for a production system, but they prove the app can boot, query seeded data, and export inventory.
