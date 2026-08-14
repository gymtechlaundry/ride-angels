# Organizations (reserved)

This folder is reserved for future organization-facing product surfaces
(hospitals, churches, nonprofits, volunteer transportation programs, etc.).

## Rules

- Individual Riders and Ride Angels remain first-class users.
- Do not add organization tabs, dashboards, billing, or admin UI until product asks.
- Gate any future routes behind `environment.organizationsEnabled`.
- Domain types live in `src/app/core/models/organization.ts`.
- Optional context: `OrganizationContextService` (personal mode = no active org).
- Authorization: `AuthorizationService` — never scatter role string checks in UI.

See `docs/organization-readiness.md` for the full architecture plan.
