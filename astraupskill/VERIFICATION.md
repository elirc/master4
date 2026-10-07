# Verification and honest coverage

## Recorded run (2026-09-12, frozen)

The JSON records in `evidence/` come from one run on Windows in an isolated staging copy (their `cwd` fields are that machine's paths); the original write-up gives Node 22.16 and npm 10.9.2. The records hold command, exit code and timing, not test counts; the count below comes from that write-up, which read the run's logs. At that time the suite was **12 tests in two files**: nine pure inventory rule tests and three API tests (health, dashboard read, CSV export). Install, client generation, schema creation, seeding, the full test run, the focused rule-test run, type checking and the build all exited 0. The focused nine-test run is a subset of the twelve, not nine more.

The run also wrote `.log` files beside each JSON record, but `*.log` is in `.gitignore`, so they are not in this repository; the JSON records (command, environment override, exit code, timing) are what remains.

## Since then (checked 2026-10-06)

`tests/reservation-api.test.ts` was added after that run, together with the per-SKU write loop in `orders.service.ts`. Counting `it(` calls, the suite is now **14 tests in three files** (9 + 3 + 2). There is no evidence record for a 14-test run in `evidence/`. What was re-run on 2026-10-06, without installing anything: the six practice checks in `05-PRACTICE.md` against `src/shared/inventoryRules.ts` with `node --experimental-strip-types --test` on Node 22.16 (five pass; Exercise 5 fails by design until `applyShipment` is fixed, and passes with the `06` solution), and the `03` demo, whose output is quoted there.

## What the evidence proves, and what it does not

The duplicate-line regression submits 14 and 9 for one SKU with 22 available. Each line fits; their sum of 23 does not, and the planner reports that combined shortage. Other assertions reject invalid quantities and direct over-reservation. `tests/reservation-api.test.ts` drives the real reserve route against the seeded SQLite file: refusal leaves `reserved` and the reservation count unchanged and writes one failure audit row; a fitting two-line order writes one reservation row of the summed quantity.

Not covered: two reservations racing for one balance, double submission of one order, rollback when a write fails mid-transaction, and browser behavior. A passing build establishes compilation and bundling only.

## Reproduce in a disposable project copy

Use a fresh copy without existing database files, dependencies or private environment files, and run these PowerShell commands from its root. **`db:push` deletes and recreates `prisma/dev.db` (`prisma/create-sqlite-schema.ts:5-9`), and `db:seed` deletes every row before inserting fixtures (`prisma/seed.ts:7-25`).** Setting `DATABASE_URL` does not redirect the schema script, which always writes `prisma/dev.db`; that is why the commands point `DATABASE_URL` at the same file. Inspect [the schema script](../prisma/create-sqlite-schema.ts) and [the seed](../prisma/seed.ts) first.

```powershell
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
$learningDbPath = Join-Path (Get-Location).Path 'prisma/dev.db'
$env:DATABASE_URL = 'file:' + $learningDbPath.Replace('\', '/')
npm run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Client generation failed' }
npm run db:push
if ($LASTEXITCODE -ne 0) { throw 'Schema creation failed' }
npm run db:seed
if ($LASTEXITCODE -ne 0) { throw 'Fixture seeding failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Type checking failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
```

An absolute SQLite URL avoids the relative-path ambiguity met during the recorded run: the seed and the tests must open the same file the schema script created. Expect 14 passing tests today. Each full run leaves one `order.reserved` domain event and one pending outbox row behind, because `tests/reservation-api.test.ts:37-42` does not delete them; re-run `db:seed` for a clean database.

## Evidence index

[installation](evidence/npm-ci-3.json), [client generation](evidence/prisma-generate.json), [schema creation](evidence/db-push.json), [absolute-path seeding](evidence/db-seed-absolute.json), [full test run](evidence/full-test-absolute.json), [focused rule tests](evidence/inventory-rules.json), [typecheck](evidence/typecheck-2.json), [build](evidence/build-2.json). Earlier failed attempts (command launch, generation-dependent type/build checks, API runs before the database was seeded) are not counted as passes and are not stored here. If your result differs, compare the first failed command, the database URL and the generated Prisma client before changing any assertion, and keep the duplicate-SKU regression intact.
