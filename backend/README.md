# Study & Task Management — Backend

Node.js / TypeScript / Express / Prisma / PostgreSQL implementation of the
backend described in *Technical Specs - Study & Tasks Application - Sep 17
2026*. Section numbers in code comments refer to that document.

## Module map (spec §67)

| Spec module                | Code                                    |
| --------------------------- | ---------------------------------------- |
| Authentication and Users    | `src/middleware/auth.ts`, `src/modules/users` |
| Study Management            | `src/modules/studies`                    |
| Study Type Management        | `src/modules/studyTypes`                 |
| Task Management              | `src/modules/tasks`                      |
| Task History                 | `src/modules/taskHistory`                |
| Dashboard and Reporting      | `src/modules/dashboard`                  |
| Audit                        | `src/modules/audit`                      |
| Administration                | RBAC via `src/middleware/authorize.ts`, user role management in `src/modules/users` |

Data model: `prisma/schema.prisma` (spec §4–10, §46).

## Getting started

```bash
cp .env.example .env      # point DATABASE_URL at a local Postgres instance
npm install
npm run prisma:migrate    # creates tables from schema.prisma
npm run seed               # creates an admin + standard user and a sample Study Type
npm run dev
```

The API listens on `http://localhost:4000`, all endpoints under `/api/v1`
(spec §39).

## Auth in this scaffold

Spec §50 asks for authentication to stay separate from domain logic so a
real provider (Entra ID / Google Workspace / Auth0) can be dropped in later.
For now:

```bash
curl -X POST http://localhost:4000/api/v1/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

returns a JWT to send as `Authorization: Bearer <token>` on every other
request. Swapping this for real SSO only touches `users.routes.ts` (the
login handler) and `middleware/auth.ts` (`authenticate`) — no other module
references either file's internals.

## Interpretive decisions

The spec is precise about data model and business rules but leaves a few
implementation details open. Where that happened, the code comments point
back to the relevant section and explain the choice:

- **Initial task dates when copying a Study Type as-is** (spec §12): the
  spec says the system "sets initial TASK dates" without an algorithm. This
  implementation chains tasks sequentially from the study's original start
  date using each template task's `default_duration_days` (default 1 day).
  See `copyStudyTypeTasksAsIs` in `studies.service.ts`.
- **TASK status transition table** (spec §18): only the five explicitly
  listed transitions are allowed (including the two backward ones); a direct
  `COMPLETE → NOT_STARTED` jump is rejected since it isn't listed. See
  `VALID_TASK_TRANSITIONS` in `tasks.service.ts`.
- **Study status transition table** (spec §19-20): analogous explicit table
  in `studies.service.ts`; the "mark Study complete?" confirmation itself is
  a UI concern — the API exposes `metrics.allTasksComplete` on a Study so
  the frontend knows when to prompt.
- **Baseline rebaseline** (spec §22): implemented as a separate,
  Administrator-only, separately audited endpoint (`POST
  /studies/{id}/rebaseline`) rather than folding it into the general Study
  update endpoint, per the spec's explicit recommendation.
- **users table**: not specified in the document but required by every
  `owner_user_id` / `created_by` / `changed_by` foreign key — added as a
  minimal `User` model with `STANDARD` / `ADMIN` roles (spec §3).

## Not yet implemented

This scaffold covers the data model, business logic, and REST API
(spec §4–53). It does not include:

- A frontend (explicitly out of scope for this pass)
- Real SSO integration (spec §50 lists options; dev-login stub stands in)
- Rate limiting / CSRF middleware wiring (spec §60 lists these as
  requirements to add before production use)
- Automated test suite (`vitest` is wired up but no tests are written yet)
- Phase 2 capabilities (spec §64) — dependencies, Gantt charts, notifications, etc. — intentionally excluded from MVP
