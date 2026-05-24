# WorkflowHub Deployment Runbook

## 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker (optional, for local PostgreSQL)

## 2. Environment Variables

Backend uses these key variables:

- `DATABASE_URL` (required)
- `JWT_SECRET` (required, strong random value)
- `PORT` (default: `4000`)
- `FRONTEND_URL` (comma-separated allowed origins for CORS)
- `RATE_LIMIT_WINDOW_MS` (default: `900000`)
- `RATE_LIMIT_MAX` (default: `200`)

Optional SMTP (email notifications):

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## 3. Build and Database Setup

From repo root:

```bash
npm ci --prefix backend
npm run build --prefix backend
npm run migrate --prefix backend
npm run seed --prefix backend
```

## 4. Start Application

```bash
npm run start --prefix backend
```

App serves:

- API: `http://<host>:4000/api`
- Fallback UI: `http://<host>:4000`

## 5. Smoke Validation

Run end-to-end validation before/after deploy:

```bash
npm run smoke:all
```

Expected final marker:

- `SMOKE_ALL_RESULT=pass`

## 6. CI Workflow

GitHub Actions workflow:

- `.github/workflows/smoke-ci.yml`

It validates build, migrations, seed, API smoke, and RBAC smoke on pushes/PRs.

## 7. Production Hardening Checklist

- Set strong `JWT_SECRET` and rotate on schedule.
- Restrict `FRONTEND_URL` to trusted origins only.
- Keep `RATE_LIMIT_MAX` and window tuned for expected traffic.
- Enforce TLS at ingress/reverse proxy.
- Restrict database network exposure.
- Enable structured logs and retention policy.
- Ensure regular database backups and restore drills.
