# Feature 001: Authentication Shell and RBAC

## Goal

Add a lightweight authentication shell and role-based authorization checks so backend endpoints have a source of truth for operational permissions.

## Impacted Areas

- `src/server/app.ts`
- `src/server/modules/platform/auth.ts`
- Backend mutation endpoints such as reservation and reconciliation

## Implementation Approach

Requests may send `x-user-id`. The API resolves that user from the database and attaches an actor context to the request. If no header is sent, the seeded admin user is used so local development remains frictionless.

Role checks are enforced on backend routes. The frontend can still improve UX later, but it is not trusted as the permission boundary.

## Design Considerations

This is not production authentication. There are no passwords, OAuth flows, cookies, JWTs, or session stores yet. The point is to establish where authorization belongs and how routes should ask for permissions.

## Build Journal

Built a small auth module with request authentication and `requireRole`. Reservation and worker reconciliation mutations now require operational roles. A junior developer should learn that authorization should be close to the backend action that changes state, not only hidden behind frontend buttons.
