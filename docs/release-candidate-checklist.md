# WorkflowHub Release Candidate Checklist

Release: 1.0.0-rc
Date: 2026-05-24
Owner: Engineering

## 1. Scope Freeze

- Confirm no breaking API or schema changes are pending.
- Confirm release notes are updated in CHANGELOG.md.
- Confirm docs are updated:
  - docs/openapi.yaml
  - docs/deployment-runbook.md
  - docs/smoke-regression-report.md

## 2. Environment Readiness

- PostgreSQL is reachable and healthy.
- Backend env values are set:
  - DATABASE_URL
  - JWT_SECRET
  - FRONTEND_URL
  - RATE_LIMIT_WINDOW_MS
  - RATE_LIMIT_MAX
- Optional SMTP values are configured if email notifications are required.

## 3. Build Gate

Run from repo root:

```bash
npm run build --prefix backend
```

Or run the combined gate:

```bash
npm run preflight
```

For release enforcement, run in strict mode:

```bash
$env:PREFLIGHT_STRICT='1'; npm run preflight
```

Pass criteria:

- Command exits with code 0.
- No TypeScript compile errors.

No-go if:

- Build fails or emits blocking compile errors.

## 4. Regression Gate

Run from repo root:

```bash
npm run smoke:all
```

Or run the combined gate:

```bash
npm run preflight
```

Pass criteria:

- Output contains:
  - SMOKE_RESULT=pass
  - SMOKE_RBAC_RESULT=pass
  - SMOKE_ALL_RESULT=pass

No-go if:

- Any smoke marker indicates fail.
- RBAC guard does not return expected forbidden behavior.

## 5. Security Gate

- Confirm CORS allow-list is restricted to trusted origins.
- Confirm rate-limit settings are set for target environment.
- Confirm JWT secret is strong and not default.
- Confirm API served behind TLS in target environment.

No-go if:

- Default or weak secrets are used.
- TLS termination and trusted origin controls are missing.

## 6. Operational Gate

- Confirm backup and restore procedure exists for PostgreSQL.
- Confirm log collection/retention destination is configured.
- Confirm on-call or incident contact path is documented.

## 7. CI Gate

- Verify latest run of .github/workflows/smoke-ci.yml is green.
- Verify build, migrations, seed, smoke-api, and smoke-rbac stages completed successfully.
- For release/mainline pushes, verify strict preflight gate completed with `PREFLIGHT_RESULT=pass`.

No-go if:

- Any CI smoke stage fails.

## 8. Manual Product Sign-off

- Sign in as admin and create task.
- Transition task through in_review and approved/rejected path.
- Add comment and reassign task.
- Verify notifications update and mark-read behavior.
- Verify audit history entries are visible and consistent.
- Verify fallback dashboard search/filter/sort and pagination behavior.

No-go if:

- Workflow transitions or dashboard state tracking are incorrect.

## 9. Release Decision

Go:

- All gates above are complete and pass.

No-go:

- Any gate fails; create remediation ticket and re-run checklist.

## 10. Post-Release Watch

- Monitor health endpoint and error logs for first 30-60 minutes.
- Re-run smoke:all after initial deployment stabilization.
