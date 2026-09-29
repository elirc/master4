# Current System Design

## Repo Structure

- `docs/architecture` contains architecture planning, journal entries, and system design notes.
- `docs/features` contains feature plans and build journals.
- `docs/walkthroughs` explains important files for learning.
- `prisma` contains the schema, local SQLite initializer, and seed data.
- `src/shared` contains domain rules and API contracts.
- `src/server` contains Express app composition and backend modules.
- `src/client` contains frontend API functions and fallback data.
- `src/worker` contains background job entrypoints.
- `tests` contains domain and API tests.

## Major Workflows

### Inventory Availability

Inventory availability is calculated as `onHand - reserved`. The calculation lives in `src/shared/inventoryRules.ts` so API views, exports, and future workers can share the same rule.

### Order Reservation

The reservation endpoint loads the order and warehouse balances, plans the reservation, updates reserved quantities, creates stock reservation rows, updates order status, writes an audit log, emits a domain event, and creates an outbox message in a single transaction.

### Reconciliation

The reconciliation worker scans low-stock alerts and creates buyer notifications. It avoids duplicating notifications if an unread one already exists.

## Design Decisions

- Modular monolith over microservices to keep learning and local development practical.
- Prisma schema as the relational source of truth.
- SQLite as the local database, with model choices that can move to PostgreSQL later.
- Shared domain rules for risky inventory math.
- Backend route guards for RBAC.
- Audit logs and domain events included from the beginning because they shape realistic maintenance work.

## Tradeoffs

- The auth shell is not production auth. It is a permission boundary scaffold.
- CSV export is synchronous and should become a background job for large datasets.
- Prisma migration engine failed in this environment, so `db:push` uses a local SQLite initializer while preserving the Prisma schema and client.
- The frontend is dense and useful, but future growth should split screens into more files.

## Future Improvements

- Real sessions/JWT or OAuth
- Tenant middleware on every query boundary
- Migration files instead of the local schema initializer
- Background job queue with retries
- Object storage for exports
- Playwright workflow tests
- CI verification
- More granular warehouse permissions
