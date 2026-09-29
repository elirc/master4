# Feature 002: Audit Log Viewer

## Goal

Expose recent audit log records through the API and surface them in the admin area.

## Impacted Areas

- `prisma/schema.prisma`
- `src/server/modules/platform/audit.service.ts`
- `src/server/app.ts`
- `src/App.tsx`

## Implementation Approach

The audit service reads recent audit records for the tenant, ordered newest first. The admin screen can use these records to explain worker runs, reservation attempts, seed initialization, and future inventory adjustments.

## Design Considerations

Audit logs are append-only from the application perspective. The first version stores metadata as JSON text because it keeps the schema flexible while the domain is still evolving.

## Build Journal

The app now has a real audit trail surface. A junior developer should learn that audit logs are not the same thing as application logs: audit logs explain business actions and should be queryable by tenant, actor, entity, and time.
