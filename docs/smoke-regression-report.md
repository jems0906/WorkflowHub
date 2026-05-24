# WorkflowHub Smoke Regression Report

Date: 2026-05-24
Environment: Windows host, backend API on http://localhost:4000
Scope: Backend API + static fallback workflow behaviors backed by API contracts

## Summary

Result: PASS (admin workflow path)

A deterministic smoke run validated core workflow operations end-to-end:
- API health
- Authentication (admin login)
- Task create
- Status transition (submitted -> in_review)
- Comment create
- Reassign task
- Audit history retrieval
- Filtered/sorted task listing
- Task stats endpoint
- Notifications list + mark-read
- Task cleanup (delete)

## Executed Checks

- HEALTH=ok
- LOGIN_ADMIN=ok
- TASK_CREATE=ok
- TASK_STATUS=in_review
- COMMENT_CREATE=ok
- TASK_REASSIGN=ok
- HISTORY_COUNT=4
- LIST_TOTAL=2 (response field is `total`)
- STATS=ok
- NOTIFICATIONS_COUNT=1
- NOTIFICATION_MARK_READ=ok
- TASK_DELETE=ok
- SMOKE_RESULT=pass

## Notes

- RBAC behavior is enforced as expected: a newly registered standard user received `Forbidden` when attempting privileged status transitions.
- Task listing response shape is `{ data, total, page, limit }` (not `pagination.total`).
- React/Vite frontend remains environment-blocked on this Windows host; backend-served fallback UI is the active demo path.

## Automation

- Run smoke regression from repo root with `npm run smoke:api`.
- Run RBAC guard regression from repo root with `npm run smoke:rbac`.
- Run full suite from repo root with `npm run smoke:all`.
- Script path: `scripts/smoke-api.ps1`.
- Script path: `scripts/smoke-rbac.ps1`.
- Script path: `scripts/smoke-all.ps1`.
- CI workflow path: `.github/workflows/smoke-ci.yml`.
- Expected terminal marker for success: `SMOKE_RESULT=pass`.
- Expected terminal marker for RBAC guard success: `SMOKE_RBAC_RESULT=pass`.
- Expected terminal marker for full suite success: `SMOKE_ALL_RESULT=pass`.

## Demo Checklist

1. Start services (`docker compose up -d`, backend API on :4000).
2. Open fallback app at http://localhost:4000.
3. Sign in as admin (`admin@workflowhub.local` / `Admin123!`).
4. Create a task from the UI and verify it appears in the table.
5. Change task status and verify row update + history entry.
6. Add a comment and verify it appears in task details.
7. Reassign task and verify assignee changes in table/details.
8. Use filters/search/sort and confirm list updates correctly.
9. Open notifications and mark one as read.
10. Open Event History panel, clear, and verify Undo countdown + token-safe restore behavior.
11. Export audit CSV from task details and confirm file download.
12. Confirm connection/live indicators and auto-refresh status are updating.
