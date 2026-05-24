# WorkflowHub QA and Ops Handoff

Date: 2026-05-24
Release Target: 1.0.0-rc

## 1. What Is Included

- Backend API with RBAC, workflow transitions, comments, audit history, notifications.
- Backend-served fallback UI at http://localhost:4000 for environments where frontend tooling is blocked.
- Smoke automation scripts:
  - scripts/smoke-api.ps1
  - scripts/smoke-rbac.ps1
  - scripts/smoke-all.ps1
  - scripts/preflight.ps1
- CI workflow: .github/workflows/smoke-ci.yml

## 2. Environment Prerequisites

- Node.js 20+
- PostgreSQL running and reachable
- Backend env configured (backend/.env)

Required env keys:

- DATABASE_URL
- JWT_SECRET
- FRONTEND_URL

Recommended security env keys:

- RATE_LIMIT_WINDOW_MS
- RATE_LIMIT_MAX

## 3. Commands to Run (Repo Root)

### 3.1 Build Gate

```bash
npm run build --prefix backend
```

Expected outcome:

- Exit code 0
- TypeScript build completes without errors

### 3.2 Smoke Gate

```bash
npm run smoke:all
```

Expected markers:

- SMOKE_RESULT=pass
- SMOKE_RBAC_RESULT=pass
- SMOKE_ALL_RESULT=pass

### 3.3 Preflight Gate (Combined)

```bash
npm run preflight
```

Expected markers:

- PREFLIGHT_PHASE=config_sanity_pass
- PREFLIGHT_PHASE=build_pass
- PREFLIGHT_PHASE=smoke_pass
- PREFLIGHT_RESULT=pass

### 3.4 Strict Release Gate (PowerShell)

```powershell
$env:PREFLIGHT_STRICT='1'; npm run preflight
```

Expected markers:

- PREFLIGHT_RESULT=pass
- No weak/default JWT warnings in strict mode

## 4. Manual QA Flow

- Sign in as admin user.
- Create a task.
- Move task through workflow states.
- Add comment.
- Reassign task.
- Confirm notifications and mark-read behavior.
- Confirm audit history entries.
- Confirm dashboard search/filter/sort/pagination.

## 5. CI Expectations

Workflow: .github/workflows/smoke-ci.yml

- Pull requests: smoke checks execute and must pass.
- Push to main/master and v* tags: strict preflight must pass.

Expected CI success marker:

- SMOKE_ALL_RESULT=pass

Strict context expectation:

- PREFLIGHT_RESULT=pass

## 6. No-Go Conditions

- Build command fails.
- Any smoke marker ends in fail.
- RBAC negative path does not produce forbidden behavior.
- Strict preflight fails on release/mainline contexts.

## 7. Escalation and Logs

- If CI fails, inspect workflow logs and backend log artifact from smoke-ci.
- Re-run local preflight and compare markers to CI output.
- If environment-related, validate DATABASE_URL and JWT_SECRET first.

## 8. Related Documents

- README.md
- CHANGELOG.md
- docs/release-candidate-checklist.md
- docs/deployment-runbook.md
- docs/smoke-regression-report.md
- docs/openapi.yaml
