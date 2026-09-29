# Atlas Fulfillment

Atlas Fulfillment is a TypeScript operations platform for warehouse and ecommerce inventory, orders, and fulfillment.

It is built as a modular monolith for learning how realistic business software grows: domain rules, database schema, API modules, background jobs, frontend workflows, tests, and architecture documentation.

## Commands

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
npm run dev:api
npm run worker
npm test
npm run build
```

## Important Docs

- `docs/architecture/initial-architecture-plan.md`
- `docs/architecture/architecture-journal.md`
- `docs/features/000-backlog.md`
- `docs/walkthroughs/`

## Project Shape

- `prisma/schema.prisma` defines the relational database model.
- `prisma/seed.ts` creates realistic tenant, warehouse, inventory, order, supplier, and fulfillment data.
- `src/server` contains the Express API and backend modules.
- `src/shared` contains domain types and business rules.
- `src/client` contains the React frontend.
- `src/worker` contains background reconciliation jobs.

## Astra upskill course

The source-specific learning path in [`astraupskill/README.md`](astraupskill/README.md)
walks through the inventory reservation bug fixed in this batch. It includes a
codebase map, domain concepts, a worked change, testing and debugging guidance,
progressive exercises, complete solutions, a trace lab, and verification notes.
