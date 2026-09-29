# Future Feature Backlog

This backlog is deliberately realistic. Each feature should get its own feature plan before implementation and a build journal after implementation.

## Phase 1: Foundation

1. Authentication shell with seeded users and session context
2. RBAC policy helpers for warehouse and admin permissions
3. Tenant isolation checks in API service boundaries
4. Audit log viewer for inventory adjustments and order actions
5. API contract documentation and health checks

## Phase 2: Inventory Depth

6. Barcode scanning UI for receiving, picking, and cycle counts
7. CSV batch import for products, SKUs, and inventory counts
8. Inventory adjustment approval workflow
9. Multi-warehouse transfer orders
10. Cycle count reconciliation jobs

## Phase 3: Orders and Fulfillment

11. Partial fulfillment and split shipments
12. Cancellation workflow that releases reservations
13. Return merchandise authorization workflow
14. Pick-pack-ship warehouse screen
15. Customer/self-service order status portal

## Phase 4: Supplier and Purchasing

16. Supplier lead time tracking
17. Purchase order receiving workflow
18. Landed cost and supplier performance reporting
19. Low-stock purchase suggestions
20. Approval workflow for large purchase orders

## Phase 5: Platform Concerns

21. Domain event outbox processor
22. Notification preferences
23. Admin settings and configurable rules
24. Reporting dashboards with export
25. Observability page with worker status and failed jobs

## Phase 6: Integrations and Quality

26. Shopify mock API integration
27. Webhook subscriptions for order and inventory changes
28. Playwright end-to-end tests for core warehouse workflows
29. CI verification workflow
30. Final system design review and maintenance guide

## Build Journal

The backlog is grouped by engineering concern, not by screen. That matters because real product work often cuts across frontend, backend, data, background jobs, and documentation. The lesson for a growing developer is to plan features by affected boundaries, not by the first button you see in the UI.
