# Render Production Hardening

## 1. Rotate JWT Secret

1. Open Render service `workflowhub`.
2. Go to Environment.
3. Update `JWT_SECRET` to a new strong random value (at least 32 chars).
4. Click Save, rebuild, and deploy.

Notes:
- Existing user sessions/tokens become invalid after rotation.
- Re-login is expected.

## 2. Use a Dedicated Database for workflowhub

Using another application's database is risky. Move workflowhub to its own PostgreSQL service when possible.

1. Create or choose a dedicated Render PostgreSQL instance for workflowhub.
2. Copy its Internal Database URL.
3. Set `DATABASE_URL` in workflowhub Environment to that URL.
4. Save, rebuild, and deploy.

Why:
- Isolated data and credentials
- Safer backups and restores
- Easier incident response

## 3. Confirm Required Env Vars

Ensure these keys are set for workflowhub:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`

Recommended `FRONTEND_URL` format:

- `https://<your-render-service>.onrender.com`

## 4. Verify Deployment Health

After every critical env change:

1. Open `https://<your-render-service>.onrender.com/api/health`
2. Confirm response contains `status: ok`.
3. Sign in and perform one task workflow action.

## 5. Tighten Postgres Network Access

If your PostgreSQL service allows broad inbound access, restrict it.

1. Open the PostgreSQL service.
2. Review Networking / Inbound IP rules.
3. Prefer private network-only access where possible.

## 6. Post-Change Regression

Run local smoke checks against deployed API:

```powershell
$env:SMOKE_API_BASE_URL='https://<your-render-service>.onrender.com/api'
npm run smoke:all
```

Expected markers:

- `SMOKE_RESULT=pass`
- `SMOKE_RBAC_RESULT=pass`
- `SMOKE_ALL_RESULT=pass`
