# WorkflowHub

A fullstack workflow management app where users create tasks/requests, route them through approvals, and track status in a clean dashboard.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- Auth: JWT + role-based access (`user`, `reviewer`, `admin`)

Note: The repo includes the full React+TypeScript frontend in `frontend/`. In environments where Windows execution policy/AV blocks Vite/esbuild child processes, a no-build fallback UI is also served by backend static files in `backend/public/`.

## Features

- User sign-in / registration
- Create tasks with title, description, assignee, priority, due date, tags
- Workflow stages: `submitted`, `in_review`, `approved`, `rejected`, `completed`
- Manager/reviewer actions: approve/reject/in-review, comment, reassign
- Dashboard with filters, search, status/priority analytics, recent items
- Audit log (`status_history`) for all workflow state changes
- In-app notifications for assignments, status changes, and comments

## Project Structure

```text
WorkflowHub/
  backend/
  frontend/
  docker-compose.yml
  package.json
```

## Quick Start

1. Start PostgreSQL:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
npm install --prefix backend
npm install --prefix frontend
```

3. Configure backend env:

```bash
copy backend/.env.example backend/.env
```

4. Run migrations and seed sample users:

```bash
npm run db:migrate
npm run db:seed
```

5. Start backend and frontend (separate terminals):

```bash
npm run dev:backend
npm run dev:frontend
```

If frontend tooling is blocked on your machine, you can still run and use the app via backend-only mode:

```bash
npm run dev:backend
```

Or simply run from repo root:

```bash
npm run dev
```

If backend is already running on port 4000, root `npm run dev` and `npm run start` return success instead of failing with a port collision.

Then open `http://localhost:4000`.

If you still want to try running Vite directly from the frontend workspace:

```bash
npm run dev:vite --prefix frontend
```

6. Open frontend:

- http://localhost:5173

## Demo Accounts

- `admin@workflowhub.local` / `Admin123!`
- `reviewer@workflowhub.local` / `Review123!`
- `user@workflowhub.local` / `User1234!`

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/:id/history`
- `GET /api/tasks/stats`

- `GET /api/tasks/:taskId/comments`
- `POST /api/tasks/:taskId/comments`

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

- `GET /api/users`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `PUT /api/users/me/password`
- `DELETE /api/users/:id`

## Notes

- In-app notifications are fully implemented.
- SMTP email notifications are also implemented on assignment, status changes, and comments when SMTP settings are configured in `backend/.env`.
- For production, set secure secrets and tighten CORS/auth/session policies.

## Smoke Test

Run a backend API smoke regression from repo root:

```bash
npm run smoke:api
```

Run RBAC negative-path smoke regression:

```bash
npm run smoke:rbac
```

Run full smoke suite (API + RBAC):

```bash
npm run smoke:all
```

Run release preflight (config sanity + backend build + full smoke suite):

```bash
npm run preflight
```

Prerequisites:

- PostgreSQL is running and migrated/seeded.
- Backend API is running on `http://localhost:4000`.
- Demo admin credentials are available (`admin@workflowhub.local` / `Admin123!`).

The script prints deterministic markers (`HEALTH=ok`, `SMOKE_RESULT=pass`) and performs cleanup for created test tasks.

The RBAC script validates that a standard user receives `403 Forbidden` when attempting a privileged status transition.

The combined suite prints `SMOKE_ALL_RESULT=pass` when both scripts pass.

Preflight prints `PREFLIGHT_RESULT=pass` when all gates complete successfully.

Set `PREFLIGHT_STRICT=1` to enforce a hard failure on weak/default JWT secrets.

## CI Automation

GitHub Actions workflow [smoke-ci.yml](.github/workflows/smoke-ci.yml) runs on push and pull requests and validates:

- PostgreSQL service boot + health
- backend build
- migrations + seed
- API smoke regression (`scripts/smoke-api.ps1`)
- RBAC regression (`scripts/smoke-rbac.ps1`)

On success, CI emits `SMOKE_ALL_RESULT=pass` in workflow logs.

On pushes to `main`/`master` and `v*` tags, CI also runs strict preflight (`PREFLIGHT_STRICT=1`).

## API Contract

- OpenAPI spec: `docs/openapi.yaml`

## Deployment

- Deployment runbook: `docs/deployment-runbook.md`
- Release candidate checklist: `docs/release-candidate-checklist.md`
- QA and ops handoff: `docs/qa-ops-handoff.md`
- Render deployment: `docs/render-deployment.md`
- Render hardening: `docs/render-hardening.md`

## Changelog

- Release notes: `CHANGELOG.md`

Optional overrides (PowerShell environment variables):

- `SMOKE_API_BASE_URL`
- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`
