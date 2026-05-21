# Release Notes

## 0.5.0 - production-ready public milestone

This release is the first version intended to be listed and installed as a small production master/agent deployment. It keeps the project below a broad `1.0` compatibility promise, but the install, runtime, CI, image and release-check paths are now explicit enough for public use.

### Release Gate

- Added `scripts/release-check.sh` as the single pre-release gate for shell syntax, agent mock execution, tokenized 3x-ui fixture coverage, compose validation, frontend build, Docker Maven backend build, disposable compose smoke and `git diff --check`.
- Moved frontend build baselines to Node 22 and enabled GitHub Actions Node 24 runtime preflight with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` for repository workflows.
- Documented live-host assumptions, Linux support boundaries, master ports, controlled-host ports, phpMyAdmin exposure risk, key backup requirements and release publishing checks.
- Added POSIX bootstrap installers for minimal hosts that need `bash` installed before the normal master or agent installer can run.
- Kept credential hardening in the release baseline: stored agent tokens and 3x-ui API/password/2FA fields are encrypted through `SECRET_ENCRYPTION_KEY`, with legacy plaintext rows still readable for gradual upgrades.

### Current Production Scope

| Area | 0.5.0 stance |
| --- | --- |
| Master install | One-command installer using public GitHub raw files and GHCR images, with source-build fallback. |
| Runtime | Docker Compose stack with MySQL, backend, frontend and optional phpMyAdmin. |
| Agent | systemd/OpenRC service that polls, executes and reports tasks without opening an inbound port. |
| 3x-ui | API-token inbound/client flows, Xray config/outbound reads, traffic sync and Xray restart; full install/configure orchestration requires systemd. |
| Snell | Managed as a protocol node through agent-generated systemd/OpenRC services and configs. |
| Safety | Master self-control guardrails, protected ports, encrypted credentials and task audit logs. |
| Verification | Local release gate plus CI backend/frontend/script/compose smoke jobs and GHCR image workflow. |

### Linux Support

| Target | Debian / Ubuntu | Rocky / Oracle Linux | Alpine / OpenRC |
| --- | --- | --- | --- |
| Master Docker stack | Supported | Supported | Supported with bootstrap installer |
| Agent / Snell / remote forwarding | systemd | systemd | OpenRC |
| Full 3x-ui install/configure | Supported | Supported | Not supported in `0.5.0`; use a systemd host |

### Known Post-Release Enhancements

- Add real disposable 3x-ui container orchestration smoke tests once a stable upstream-compatible fixture is selected.
- Add a documented key-rotation migration for encrypted 3x-ui credentials and API tokens.
- Clean remaining legacy upstream wording and mojibake comments in a dedicated documentation pass.

## 0.4.0 - P1-P4 productization batch

This is the first public-facing productization milestone for Flux 3x-ui Orchestrator. It keeps the project pre-1.0 while making the repository easier to install, verify, operate and release.

### Highlights

- Hardening update: `role=master` servers can be selected intentionally, while destructive actions and protected listen ports such as frontend/backend/MySQL/SSH are blocked.
- Sensitive stored agent tokens and 3x-ui API/password/2FA fields are encrypted through `SECRET_ENCRYPTION_KEY`, with plaintext legacy rows still readable.
- The 3x-ui fixture now covers Bearer token success, missing-token and wrong-token paths in addition to inbound/outbound/config/traffic/restart routes.
- Frontend forms include compact helpers for UUID, Reality private key/shortId, Snell PSK and outbound tag choices.
- Master panel installer for public GitHub raw files and GHCR images, with source-build fallback when GHCR pulls are unavailable.
- Controlled-server agent installer and service runner for claiming deployment tasks, executing scripts and reporting results.
- Multi-server orchestration workspace for registered servers, 3x-ui connection settings, protocol nodes, Snell nodes, port forwards, deployment tasks and traffic snapshots.
- 3x-ui connector coverage for connection tests, inbound CRUD, client operations, full Xray config reads, outbound traffic reads, Xray restarts and traffic sync.
- One-click orchestration tasks that can install or reuse 3x-ui, create starter Xray protocols, install Snell and return runtime metadata.
- Unified rule center and monitor alert center in the master workspace for day-2 operations across servers.
- Stateful 3x-ui API fixture for regression coverage of inbound/client/outbound/config/traffic/restart routes.
- Docker Compose files for IPv4 and IPv6 deployments using GHCR backend/frontend images.
- CI-oriented verification commands for backend package builds, frontend production builds, agent mock tests and disposable compose smoke tests.

### 0.4.0 Capability Matrix

| Area | Current state |
| --- | --- |
| Master install | `scripts/install-master.sh` via GitHub raw URL; installs into `/opt/flux-3xui-orchestrator`. |
| Master runtime | Docker Compose with MySQL 5.7, backend, frontend and optional phpMyAdmin. |
| GHCR images | `ghcr.io/zhizhishu/flux-3xui-orchestrator-backend:latest` and `...-frontend:latest`. |
| Source fallback | Installer can download the public source archive and build images locally when GHCR pull fails. |
| Agent install | `scripts/install-flux-agent.sh` creates `/etc/flux-agent.env`, `/usr/local/bin/flux-agent.sh` and `flux-agent.service`. |
| Agent execution | Polls task claim/report APIs, stores work under `/var/lib/flux-agent`, supports retries and task timeouts. |
| 3x-ui management | API-token flows for inbounds and clients; login+CSRF path for full Xray/outbound operations. |
| Snell support | Product-level protocol node backed by agent-generated systemd services and config files. |
| Port forwarding | Remote `socat` systemd services through auditable agent tasks. |
| Traffic | Manual and scheduled 3x-ui traffic sync into local snapshots. |
| Monitor alerts | Agent offline, service failure, certificate expiry, task failure/timeout and traffic anomaly alerts with acknowledgement API. |
| 3x-ui regression | Local Python fixture and shell test covering tokenized core 3x-ui proxy routes. |
| CI verification | Backend/frontend build, agent mock test, 3x-ui fixture test, compose dry run and disposable compose smoke test. |

### Verification Commands

Local build checks:

```bash
cd springboot-backend
mvn -B -DskipTests package

cd ../vite-frontend
npm install --legacy-peer-deps --no-audit --no-fund
npm run build
```

Containerized checks:

```bash
docker run --rm -v "$PWD/springboot-backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -DskipTests package
docker run --rm -v "$PWD:/workspace" -v flux_3xui_frontend_node_modules:/workspace/vite-frontend/node_modules -w /workspace/vite-frontend node:22-bookworm bash -lc "npm install --legacy-peer-deps --no-audit --no-fund && npm run build"
```

Smoke checks:

```bash
bash scripts/test-flux-agent-mock.sh
bash scripts/test-three-xui-fixture.sh
bash scripts/test-compose-smoke.sh --build-local --dry-run
bash scripts/test-compose-smoke.sh --build-local
```

Release checklist:

```bash
docker compose -f docker-compose-v4.yml config
docker compose -f docker-compose-v6.yml config
```

### Known Gaps Before 1.0

- The included 3x-ui fixture is API-level; real-container 3x-ui orchestration smoke tests should still be added before a broad 1.0 compatibility claim.
- Key rotation for encrypted credentials is intentionally not automatic yet and should be handled through a planned migration.
- Legacy Flux Panel scripts and docs still contain some upstream-era wording and mojibake text that should be cleaned in a separate documentation pass.
