# Atlas Fulfillment (master4) interview kit

Atlas Fulfillment is a warehouse and order management monolith: an Express API over Prisma and SQLite, a React and Vite frontend, a reconciliation worker, and a shared rules module that both sides import. The astraupskill course follows one sales order through inventory reservation. This folder turns that into hiring material for CRUD backend roles.

## The pitch

"I own order reservation in a fulfillment system. The invariant is that an order cannot reserve more units of a SKU than the warehouse has available to promise, where available is on hand minus already reserved. The bug I fixed is that an order may hold two lines for the same SKU, for example when a UI appends an item instead of merging it, and each line was being checked against the full balance on its own. Two lines of forty against a balance of fifty both passed, and the order reserved eighty. Planning now sums demand per SKU before comparing it with availability, the write loop aggregates by SKU so there is one reservation row per SKU rather than one per line, and the pure rule is called again at the write so it guards the transaction rather than only the plan. The whole thing is one Prisma transaction: inventory increments, reservation rows, the order status change, the domain event, the outbox message and the audit row all commit together or not at all."

## Target stack

Node, TypeScript, Express, Prisma (SQLite in this project), Vitest with supertest. The patterns transfer directly to ASP.NET Core with EF Core; the shared pure rules module is the part that translates with no changes in shape at all.

## Two-week plan

Note (2026-10-06): only this README exists in `dfableandopus/` in this repository; the six files linked below (`01`-`06`) were never committed here, so those links do not resolve. The plan's code-reading targets are real.

- Days 1-2: [01-INTERVIEW-QUESTIONS.md](01-INTERVIEW-QUESTIONS.md), screening group, with `src/shared/inventoryRules.ts` open. It is 126 lines and it is the heart of the interview.
- Days 3-5: the deep-dive group alongside `src/server/modules/orders/orders.service.ts`. Be able to walk `reserveSalesOrder` from the order lookup to the outbox row.
- Days 6-7: [03-CODE-READING-DRILL.md](03-CODE-READING-DRILL.md), timed.
- Days 8-9: [02-STORIES-AND-RESUME.md](02-STORIES-AND-RESUME.md). The aggregation story has a real regression test behind it, which is what makes it tell well.
- Days 10-12: [04-TAKE-HOME.md](04-TAKE-HOME.md), against the seeded SQLite database the existing tests use.
- Day 13: [05-SYSTEM-DESIGN-FOLLOWUPS.md](05-SYSTEM-DESIGN-FOLLOWUPS.md).
- Day 14: [06-FLASHCARDS.md](06-FLASHCARDS.md).

## What the evidence actually says

The recorded run is `npx vitest run` with `DATABASE_URL=file:./dev.db`: 3 files, 14 tests passing, and `npm run typecheck` at exit 0. The suite is unusual in a useful way. `tests/inventoryRules.test.ts` is pure and needs nothing; `tests/api.test.ts` and `tests/reservation-api.test.ts` drive the real Express app with supertest against the seeded SQLite database, so they exercise real Prisma queries and real rows. `tests/reservation-api.test.ts` cleans up most of what it creates, but not all: its `afterAll` (lines 37-42) removes the audit rows, reservation rows, lines and order, not the `DomainEvent` and `OutboxMessage` its success case writes, so each run leaves those two rows in `prisma/dev.db` until the next `db:seed`. (This 14-test run is not among the `astraupskill/evidence` records, which are from the earlier 12-test run; see `astraupskill/VERIFICATION.md`.)

That means the reservation evidence here is stronger than a mocked suite: the refusal case proves the inventory balance and the reservation count are unchanged in the database, not merely that a mock was not called. What it does not cover is concurrency, since SQLite and a single-process test run do not exercise two writers racing for the same balance.
