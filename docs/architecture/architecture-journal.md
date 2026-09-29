# Architecture Journal

## 2026-05-05: Initial Direction

The project is being rebuilt from a frontend-only workflow prototype into Atlas Fulfillment, a realistic inventory, orders, and fulfillment platform.

The first major decision is to use a modular monolith. For learning, this is more valuable than prematurely splitting services because it keeps local development simple while still forcing module boundaries. A junior developer should notice that "monolith" does not mean "all logic in one file." It means one deployable unit with clear internal ownership.

The second decision is to use Prisma with SQLite. SQLite keeps the app easy to run on one machine, while Prisma gives the project a real relational schema, generated client, migrations/push workflow, and seed process.

The third decision is to write domain rules as plain TypeScript helpers before wiring them to HTTP. This makes the important business logic testable without a server, database, or browser.

## 2026-05-05: Initial Build

The initial system now has a Prisma schema, local SQLite database initializer, seed data, Express API, React operations console, shared inventory rules, a reconciliation worker, tests, and code walkthrough documentation.

One notable tradeoff: Prisma Client generation works, but the Prisma schema engine failed during `prisma db push` in this Windows environment. To keep the project runnable, `npm run db:push` creates the SQLite schema with Node's built-in SQLite module. The Prisma schema remains the domain model source, and Prisma Client still reads/writes the database.

Feature work also started immediately after the initial build:

- Authentication/RBAC shell
- Audit log viewer
- Inventory CSV export

The learning point is that "future platform concerns" are not decorative. Even tiny versions of auth, audit, exports, events, and workers change where code belongs.
