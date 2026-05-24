# Render Deployment

## 1. Prerequisites

- Repository pushed to GitHub
- Render account connected to GitHub

## 2. Deploy Using Blueprint

This blueprint creates the web service only. Use an existing PostgreSQL instance by setting `DATABASE_URL`.

1. In Render, click New and then Blueprint.
2. Select this GitHub repository.
3. Confirm creation of web service: `workflowhub`.
4. Complete deploy.

## 3. Required Environment Values

Set these values in the web service environment before first successful start:

- `DATABASE_URL` (connection string for an existing Render PostgreSQL instance)
- `FRONTEND_URL` (your Render app URL)

Example `FRONTEND_URL`:

- `https://workflowhub.onrender.com`

Then redeploy the service.

## 4. Health Check

- Health path: `/api/health`
- Expected response: `{ "status": "ok" }`

## 5. Post-Deploy Validation

Run these checks against the deployed app URL:

1. Open app root (`/`) and log in with seeded demo user.
2. Verify task create/update/comment/reassign flows.
3. Verify notifications and history behavior.

Optional API smoke from local machine (PowerShell):

```powershell
$env:SMOKE_API_BASE_URL='https://<your-service>.onrender.com/api'
npm run smoke:all
```

## 6. Notes

- Free plans may cold-start.
- If your workspace already has one active free Postgres, Render will reject provisioning another free database.
- `startCommand` runs migrations and seed each deploy; seed is idempotent.
