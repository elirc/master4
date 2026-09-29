# Feature 003: CSV Export

## Goal

Add an operational CSV export for inventory balances.

## Impacted Areas

- `src/server/modules/platform/export.service.ts`
- `src/server/app.ts`
- Admin frontend actions

## Implementation Approach

The export service reuses the inventory read model and serializes a compact CSV. This avoids duplicating inventory availability calculations in export code.

## Design Considerations

The first export is synchronous because the dataset is tiny. At scale, exports should become background jobs with object storage links and audit records.

## Build Journal

The first CSV export was added through a shared read model. A junior developer should notice the design lesson: exports should call the same domain/application services as the UI, otherwise reports drift from what operators see on screen.
