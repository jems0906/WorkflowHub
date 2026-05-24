# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-05-24

### Added
- End-to-end workflow product foundations across backend, frontend, and fallback UI.
- Role-based workflow lifecycle with status transitions: submitted, in_review, approved, rejected, completed.
- Task comments, reassignment, audit history, dashboard filtering, search, sorting, and pagination flows.
- In-app notifications and optional SMTP email notifications.
- OpenAPI contract at docs/openapi.yaml.
- Deployment runbook at docs/deployment-runbook.md.
- Automated smoke scripts:
  - scripts/smoke-api.ps1
  - scripts/smoke-rbac.ps1
  - scripts/smoke-all.ps1
- GitHub Actions smoke workflow at .github/workflows/smoke-ci.yml.

### Changed
- Backend security defaults hardened with Helmet, API rate limiting, stricter CORS origin validation, and JSON payload size limit.
- Environment template expanded with rate-limit controls and explicit multi-origin frontend configuration.
- Frontend configuration cleanup to keep vite.config.js as the canonical Vite config.

### Fixed
- Workflow listing sort input hardening with backend sort field whitelist and sanitized direction handling.
- Event history clear and undo reliability with token-guarded stale undo prevention.
- Multiple fallback UI reliability and usability improvements for refresh behavior, connection state, and event-history actions.

### Security
- Added response hardening middleware and API throttling in backend startup pipeline.
- Strengthened CORS enforcement to explicitly approved origins.

### CI and Quality
- Added reproducible smoke validation flow suitable for local checks and CI execution.
- Added RBAC negative-path regression checks that assert expected forbidden transitions.
