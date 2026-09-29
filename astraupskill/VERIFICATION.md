# Verification and honest coverage

The changed inventory rules were checked on Windows with Node 22.16 and npm 10.9.2. The final full run passed **12 tests in two files**: nine pure inventory rule tests and three API health, dashboard-read and CSV-export tests. Type checking and the TypeScript/Vite build also passed. The focused nine-test run is a subset of those twelve, so it is not an additional nine unique tests.

## What the evidence proves

The duplicate-line regression submits quantities 14 and 9 for one SKU with 22 available units. Each line fits independently; their combined demand of 23 does not. The planner now reports that combined shortage. Other new assertions reject invalid quantities and direct helper over-reservation. Source review confirmed that the real reservation service calls the planner before its inventory, reservation, order, event and outbox writes. Its rejected-decision branch still writes a failure audit. Rejection therefore does not imply that every table remains unchanged.

The API tests read seeded data; they do not exercise the reservation write endpoint. A passing build establishes compilation and bundle generation, not browser usability. Concurrent reservation correctness, persistent write rollback, invalid stored balances and external delivery remain separate exercises.

## Reproduce in a disposable project copy

Use a fresh copy of the project without existing database files, dependencies or private environment files. Run the following PowerShell commands from that copy's root. **The existing `db:push` script recreates `prisma/dev.db`, and `db:seed` deletes rows before inserting fixtures.** These commands belong in the disposable copy because changing `DATABASE_URL` does not redirect the custom schema creation script. Inspect [that script](../prisma/create-sqlite-schema.ts) and [the seed](../prisma/seed.ts) first.

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

An absolute SQLite URL avoids the relative-path ambiguity encountered during verification. Successful fixture creation alone is not enough: the seed and tests must open that same file. The actual recorded run used an absolute URL inside the isolated staging copy. No original project database was copied, reset or seeded. Database files and generated dependency/build folders are not part of this delivery.

## Recorded results and earlier failures

The final [full test log](evidence/full-test-absolute.log) and [machine-readable run record](evidence/full-test-absolute.json) show the twelve passing tests and the precise database override. The [focused test log](evidence/inventory-rules.log), [typecheck log](evidence/typecheck-2.log) and [build log](evidence/build-2.log) provide the other outcomes. Successful setup records are included for [installation](evidence/npm-ci-3.json), [client generation](evidence/prisma-generate.json), [schema creation](evidence/db-push.json) and [absolute-path seeding](evidence/db-seed-absolute.json).

Earlier command-launch attempts failed, initial generation-dependent type/build checks failed, and initial API runs returned errors before the database was correctly initialized and seeded. Those failures remain in the central audit history; they are not counted as passes. The final commands above explain the setup that resolved them. If your local result differs, compare the first failed command, database URL and generated Prisma client before changing application assertions. Keep the duplicate-SKU regression intact: relaxing it would remove the evidence for the behavior repaired here.
