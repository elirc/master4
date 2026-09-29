# Initial Architecture Plan: Atlas Fulfillment

## Product Goal

Atlas Fulfillment is an operations platform for a warehouse or ecommerce business. The first version should teach realistic business software design: inventory availability, stock reservations, purchasing, sales orders, fulfillment, returns, low-stock alerts, audit trails, and admin dashboards.

The system is intentionally built as a modular monolith. That means the code runs as one deployable application, but the codebase is organized around domain boundaries so it can grow without becoming a single tangled CRUD app.

## Initial Scope

The initial build includes:

- Products, SKUs, suppliers, warehouses, and inventory counts
- Purchase orders and sales orders
- Stock reservations that reduce available-to-promise inventory
- Shipments and returns data
- Low-stock alert detection
- Admin dashboard metrics
- Background reconciliation worker shape
- Domain events, outbox records, and audit adjustment models in the schema
- Frontend operations screens for dashboard, inventory, orders, purchasing, fulfillment, alerts, and admin

## Tech Stack

- TypeScript for all application code
- React + Vite for the frontend
- Express for the backend API
- Prisma + SQLite for the first database layer
- Zod for request validation
- Vitest for domain and API tests
- tsx for local TypeScript scripts and server execution

SQLite is used so the project is easy to run locally. The schema is written to preserve concepts that would translate cleanly to PostgreSQL later: tenant ownership, explicit IDs, unique constraints, status fields, event/outbox tables, and timestamped audit records.

## Module Boundaries

### Catalog

Owns products and SKUs. Other modules refer to SKU IDs, but catalog owns SKU metadata such as SKU code, barcode, dimensions, product relationship, and active/inactive state.

### Warehouse

Owns warehouses, inventory balances, inventory adjustments, transfer planning, and low-stock calculations. It is the source for on-hand, reserved, available, reorder point, and safety stock values.

### Purchasing

Owns suppliers and purchase orders. Receiving inventory should eventually create inventory adjustments and domain events.

### Orders

Owns sales orders, order lines, reservations, cancellation rules, and status transitions.

### Fulfillment

Owns shipments and returns. It depends on orders and warehouse inventory, but it should not own product metadata.

### Platform

Owns tenancy, users, roles, audit events, domain events, outbox messages, notifications, health checks, and worker orchestration.

## Data Consistency Rules

Inventory systems are dangerous because a simple update can create business damage. The first version keeps these rules explicit:

- Available quantity is `onHand - reserved`.
- A reservation must fail if requested quantity is greater than available quantity.
- Reserving stock increments `reserved`, not `onHand`.
- Shipping reserved stock decrements both `onHand` and `reserved`.
- Returns increase `onHand` after inspection or restock.
- Every inventory mutation should be explainable through an adjustment, order, shipment, return, or reconciliation record.

## API Shape

The first backend is intentionally small:

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/inventory`
- `GET /api/orders`
- `GET /api/purchase-orders`
- `GET /api/shipments`
- `GET /api/alerts/low-stock`
- `POST /api/orders/:orderId/reserve`
- `POST /api/worker/reconcile`

The backend is the source of truth for inventory math and authorization-ready workflow rules. The frontend can show/hide actions later, but backend modules must still enforce rules.

## Frontend Shape

The frontend is an operations console, not a marketing page. It should be dense, scannable, and useful for repeated work:

- Left navigation by operational area
- Dashboard metrics and exception queues
- Inventory table with availability math
- Sales order queue with reservation status
- Purchase order and shipment panels
- Low-stock alerts and background job output

## Testing Strategy

The first tests focus on domain rules because they are high-risk:

- Reservation succeeds only when available inventory is sufficient.
- Reservation failure returns a useful reason.
- Shipping reserved stock updates on-hand and reserved quantities correctly.
- Low-stock alerts trigger from reorder point and safety stock rules.
- API health and dashboard endpoints can be exercised without a browser.

## Build Journal

This document was created before implementation to set boundaries. The most important lesson is that architecture starts with ownership: which module owns a concept, which modules may reference it, and which rules must never be duplicated casually.
