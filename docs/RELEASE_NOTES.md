# Release Notes

## 0.6.0 - reliability gate

This release moves the project from the first public production milestone into a reliability-focused release candidate. It is still below a `1.0` compatibility promise, but the installer, agent and CI checks now catch more real-world setup problems before users send tasks to live servers.

### Reliability Additions

- Added non-destructive `doctor` commands for the master installer, agent installer and local agent runtime.
- Added `scripts/test-install-matrix.sh` to run installer diagnostics inside Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux containers.
- Added a CI `install-matrix` job that runs the same diagnostics per image.
- Extended `scripts/release-check.sh --full` so the release gate includes the install matrix before the disposable compose smoke test.
- Added `microdnf` support to master/agent installers and bootstrap scripts for Oracle Linux slim-style images.
- Added agent maintenance deployment tasks for remote `doctor`, `logs`, `restart-agent` and `upgrade-agent` actions through the existing task claim/report channel.
- Added a server-card `Agent` action group in the orchestrator UI for diagnostics, logs, restart and upgrade.
- Strengthened agent diagnostics so Python is treated as a blocking runtime dependency instead of a soft warning.
- Future branch update: agent maintenance now also covers delayed uninstall, install diagnostics, ACME/certificate diagnostics, firewall diagnostics, one-click 3x-ui/Xray/Snell repair and failed-task retry from the task card.
- Future branch update: added `scripts/build-release-bundle.sh` and a `Release` workflow that validates `VERSION`, runs `scripts/release-check.sh --full`, builds a tarball plus sha256 checksum and uploads both to GitHub Releases for `v*` tags or manual runs.
- Future branch update: added a first-run setup guide to the master control center, covering server registration, controlled-agent install, 3x-ui/Snell orchestration, rule/traffic sync and pre-release firewall checks.
- Future branch update: tightened the master compose layout to a single public entry port: `5166/tcp` serves both browser users and controlled-agent callbacks, while backend `6365`, MySQL and phpMyAdmin stay internal unless explicitly exposed for debugging or maintenance.
- Future branch update: added the default `flux-master` single image. The Vite UI is built into the Spring Boot jar, so the default compose stack is now `mysql + flux-master`; split backend/frontend compose files remain as legacy debug/rollback files.
- Future branch update: refined protocol-node creation with structured form checks for target server, port reuse, credentials, Reality fields, Snell PSK/version and outbound tags; the generated inbound JSON is now an advanced preview instead of the default editing surface.
- Future branch update: install, certificate and firewall diagnostics now emit structured `diagnostics.items`; the master task card summarizes DNS, port `80`, certificate-file, ACME-tooling, local-firewall and cloud-firewall findings before users open raw logs.
- Future branch update: connected the legacy Flux forwarding page to the shared `zh-CN` / `en-US` dictionary for its main flows, including toasts, form validation, empty states, import/export, delete confirmation, address copy and diagnostics modals.
- Future branch update: added Nano controlled-server detection from agent heartbeat memory totals. The master stores `nano-critical` below `200 MB`, `nano` below `256 MB`, `small` below `512 MB`, raises low-memory alerts and blocks full 3x-ui/Xray orchestration plus Xray protocol-node creation on `nano-critical` hosts.
- Future branch update: added the Runtime Provider registry for `xui`, `snell`, `forward`, `certificate` and `firewall`; deployment tasks now expose provider metadata to the master UI and controlled-agent claim payloads.
- Future branch update: connected Runtime Provider metadata through the controlled-agent execution report path. Agents log and report the claimed provider, while the master attaches provider audit metadata to stored task results when older agents omit it.
- Future branch update: added normalized `resultJson.runtimeState` to task results and the master task card. Runtime status now records provider, protocol/action, task state, resolved status/source, service states, node/forward counts, certificate state and diagnostic summaries in one model.
- Future branch update: added the State Sync runtime overview API and control-center panel. The master aggregates latest task runtime states with server heartbeat service/certificate fields, producing a server-by-provider view for XUI/Xray, Snell and certificate health.
- Future branch update: State Sync rows can now create provider-aware `agent-maintenance` diagnostics and XUI/Snell repair tasks, keeping the visible state panel connected to the same controlled-agent execution/report path.
- Future branch update: `agent-maintenance logs` now returns structured `logs.items` for Flux agent, x-ui/Xray, Snell, forwarding and task-log sources, and the master task card can show a remote-log summary before raw output.

### 0.6.0 Capability Matrix

| Area | 0.6.0 stance |
| --- | --- |
| Master install | Same one-command installer as 0.5.0, now with a pre-install doctor for ports, Docker/Compose and `.env` checks. |
| Master runtime | Default Docker Compose uses MySQL plus the `flux-master` single image on port `5166`; legacy split backend/frontend compose files are retained for rollback/debug only. |
| Agent install | systemd/OpenRC installer plus preflight doctor and local runtime doctor. |
| Agent maintenance | Remote diagnostics, log collection, restart and upgrade tasks generated from the master panel. |
| Release packaging | Future branch includes a clean-tree release bundle builder and GitHub Release workflow; release assets include the tarball and `.sha256`. |
| First-run UI | Future branch includes a Flux-style setup guide in the master control center for the first operational path. |
| Protocol-node UI | Future branch defaults to structured node forms with configuration checks and a collapsible advanced payload preview. |
| Diagnostic UI | Future branch shows structured task-card diagnostics for install, ACME/certificate and firewall checks, with raw result access retained. |
| Legacy forwarding UI | Future branch translates the main forwarding workflows through the shared `zh-CN` / `en-US` dictionary and unifies empty/failure/status wording. |
| Nano controlled hosts | Agent heartbeat reports total memory; the master badges low-memory servers and keeps sub-200 MB hosts on Snell or remote-forwarding paths. |
| Runtime Provider / Runtime State audit | Task claim/report results carry provider metadata and normalized runtime state for `xui`, `snell`, `forward`, `certificate` and `firewall`, giving the master a stable audit trail across agent versions. |
| State Sync overview | `/api/v1/deploy-task/runtime-state/overview` aggregates latest runtime states plus heartbeat fields into a server-by-provider operations panel. |
| State Sync actions | Runtime rows can generate provider-aware diagnostics and XUI/Snell repairs as normal `agent-maintenance` tasks for the controlled agent. |
| Remote runtime logs | `agent-maintenance logs` reports structured `logs.items` for Flux agent, x-ui/Xray, Snell, forwarding and task logs, with task-card summaries in the master UI. |
| Linux coverage | Docker/CI diagnostics cover Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux userspaces. |
| 3x-ui | API fixture remains API-level; full 3x-ui install/configure still targets systemd hosts. |
| Snell | Product-level protocol node with separate systemd/OpenRC runtime, not a native Xray/3x-ui core protocol. |
| Verification | Shell syntax, agent mock, 3x-ui fixture, frontend build, backend Maven build, install matrix and single-image compose smoke. |

### Honest Boundaries

- The Linux matrix in this release is Docker/CI preflight coverage. It is not yet the full real-VPS matrix with public DNS, cloud firewall, ACME HTTP validation and real service managers.
- The included 3x-ui fixture is API-level. A real 3x-ui container or VPS end-to-end smoke test is still the next reliability milestone.
- Snell is unified at the product/control-plane layer. It remains a separate runtime service managed by the Flux agent rather than a native Xray protocol inside 3x-ui.
- Nano detection is a protection layer, not a promise that 3x-ui/Xray will run well on tiny hardware. Sub-200 MB hosts should be treated as Snell or forwarding nodes unless swap and real-host testing prove otherwise.
- Enterprise-grade governance is still future work: RBAC, full audit log views, key-rotation migration, agent token expiry/revocation and dangerous-operation confirmation.

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
