# PROJECT_CONTEXT.md

## Purpose

Flux 3x-ui Orchestrator is an independent master/agent operations panel based on Flux Panel UI direction and forwarding-panel foundations. It keeps the original forwarding management concepts, then adds multi-server orchestration for 3x-ui, Xray/Reality, Snell, remote port forwarding, certificates, traffic snapshots, service status, diagnostics, and agent maintenance tasks.

The project is currently a `0.6.0` public-trial reliability candidate, not a broad `1.0` long-term production guarantee.

## Runtime Architecture

- Master stack runs through Docker Compose.
- `mysql`: MySQL 5.7 with `gost.sql` seed data. Host port is not published by default.
- `master`: `flux-master` single image. The Dockerfile builds the Vite UI, embeds it into the Spring Boot jar, and serves both Web UI and API on container port `5166`.
- `phpmyadmin`: optional maintenance override only. It is not part of the default compose stack and is created by the installer only when `PHPMYADMIN_PORT` is set.
- Legacy split `backend`/`frontend` compose files are retained as `docker-compose.legacy-v4.yml` and `docker-compose.legacy-v6.yml` for rollback/debug only.
- During install or upgrade, the installer removes old split-stack containers named `vite-frontend`, `springboot-backend`, and `gost-phpmyadmin` before starting the single-image master stack.

Default public master exposure:

```text
0.0.0.0:5166->5166/tcp
```

Internal by default:

```text
mysql 3306
phpMyAdmin 80, only when the optional override is enabled
```

## Controlled Server Model

- The controlled server installs `flux-agent.sh` through `scripts/install-flux-agent.sh` or the POSIX bootstrap.
- The agent stores `FLUX_PANEL_URL`, `FLUX_SERVER_ID`, and `FLUX_AGENT_TOKEN`.
- The agent claims tasks from the master, executes them locally, and reports results back.
- Controlled agent callback uses the same master URL as browser users, normally `http://MASTER_IP:5166`.
- The agent does not require its own inbound public management port.

Controlled hosts may expose business ports depending on orchestration choices:

- 3x-ui panel port, default `5168` when intentionally enabled.
- Xray inbound ports.
- Snell listen ports.
- Remote forwarding listen ports.
- ACME HTTP `80` when `acme-http` certificate mode is selected.

## Main Code Areas

- `springboot-backend/`: Spring Boot 2.7, Java 21 backend.
- `springboot-backend/src/main/java/com/admin/controller/`: REST endpoints under `/api/v1/*` plus `/flow/test` health endpoint.
- `springboot-backend/src/main/java/com/admin/runtime/`: Runtime Provider registry for XUI, Snell, Forward, Certificate and Firewall task boundaries.
- `springboot-backend/src/main/java/com/admin/service/`: orchestration, 3x-ui, Snell, forwarding, agent task, traffic, alert, and control-server services.
- `springboot-backend/src/main/resources/mapper/`: MyBatis mapper XML.
- `vite-frontend/`: React 18 + Vite + HeroUI frontend.
- `vite-frontend/src/pages/orchestrator.tsx`: master control center for servers, 3x-ui, Snell, rules, tasks, diagnostics, and traffic workflows.
- `vite-frontend/src/pages/forward.tsx`: legacy Flux forwarding page, now partly internationalized.
- `vite-frontend/src/i18n/index.tsx`: lightweight `zh-CN` / `en-US` dictionary.
- `scripts/`: installers, agent runtime, release checks, fixtures, and smoke tests.
- `docs/`: GitHub Pages site, operations docs, release notes, and screenshots.
- `.github/workflows/`: CI, Docker image build, and release workflows.

## Core Features

- Flux-style dense operations UI with Chinese-first language and `zh-CN` / `en-US` switch.
- Server registry, agent token generation/rotation, heartbeats, status updates, and Nano memory detection.
- Runtime Provider registry and API for `xui`, `snell`, `forward`, `certificate`, and `firewall` task assignment.
- Runtime Provider Action Catalog for `agent-maintenance` labels, categories, danger flags and State Sync visibility; backend validation and master UI buttons reuse it.
- Runtime Provider metadata travels through task claim/report and is stored in task result JSON for audit.
- Runtime State is stored in `resultJson.runtimeState` and rendered on task cards, normalizing provider, protocol/action, task state, resolved status/source, services, nodes, forwarding, certificates and diagnostics.
- Xray/3x-ui deployment scripts are executable by the controlled agent: they resolve saved/local 3x-ui API metadata, call inbound add/delete or restart-Xray APIs, and return inbound metadata through `FLUX_AGENT_RESULT_JSON`.
- Agent task results are sanitized before storage: the master can use raw reports to update encrypted 3x-ui credentials, but stored task history removes API tokens, passwords, 2FA codes and `serverSecrets`.
- Firewall Runtime Provider maintenance includes executable `open-runtime-ports` and `close-runtime-ports` tasks that parse task ports, apply local `ufw`, `firewalld` or `iptables` rules, and return structured diagnostics. Cloud security groups remain an operator boundary.
- State Sync overview aggregates latest `runtimeState` task results with server heartbeat service/certificate fields through `/api/v1/deploy-task/runtime-state/overview` and renders a server-by-provider panel in the master control center.
- State Sync row actions reuse `agent-maintenance` tasks so operators can start provider diagnostics and XUI/Snell repair flows directly from the runtime overview.
- Agent maintenance log collection returns structured `logs.items` for Flux agent, x-ui/Xray, Snell, forwarding and task-log sources, and the master task card renders a remote-log summary.
- Agent maintenance upgrade returns structured `maintenance.upgrade` metadata with source URL, previous/new version, SHA-256, backup path, install state and restart scheduling.
- One-click orchestration tasks for 3x-ui/Xray and Snell.
- 3x-ui API integration for inbound/outbound/config/traffic/restart operations.
- Protocol-node form flow with validation and advanced payload preview.
- Snell managed as a unified product-layer protocol node deployed by the Flux agent.
- Remote port forwarding through `socat` and systemd/OpenRC service scripts.
- Agent maintenance actions: diagnostics, logs, restart, upgrade, uninstall, retry, and repair.
- Structured certificate/firewall/install diagnostic summaries in task results.
- Local traffic snapshot sync for 3x-ui.
- Master port contract check: `scripts/test-master-port-contract.sh` validates that default compose files publish only the `flux-master` entry and that installer migration guards stay in place.

## Install And Upgrade

Master install:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

Existing master upgrade:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash -s -- upgrade
```

Controlled agent install:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://MASTER_IP:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="TOKEN" bash
```

## Verification Baseline

CI currently covers:

- Backend Maven build.
- Frontend Vite build.
- Shell syntax.
- Agent mock tests, including Runtime Provider claim/report metadata.
- Backend Runtime Provider / Runtime State tests for task-result audit metadata.
- 3x-ui fixture tests.
- Optional real 3x-ui E2E contract smoke through `scripts/test-three-xui-e2e.sh`; it skips unless endpoint/token are configured and only performs write checks when explicitly enabled.
- Default, v4/v6 and legacy compose config.
- Disposable compose smoke stack with the `flux-master` single image.
- Debian, Ubuntu, Alpine, Rocky Linux, and Oracle Linux installer diagnostics.

Release gate:

```bash
bash scripts/release-check.sh --full
```

## Known Boundaries

- Real VPS matrix and recorded real 3x-ui end-to-end smoke runs are still the biggest gaps before `1.0`; the E2E harness exists but does not prove real-host coverage until endpoint secrets are configured and run.
- Snell is product-layer unified but runtime-independent; do not describe it as a native 3x-ui/Xray protocol.
- Alpine/OpenRC supports the agent, Snell tasks, and remote forwarding, but full 3x-ui install/configure orchestration is intended for systemd hosts.
- Certificate automation depends on DNS, port `80`, local firewall, and cloud security groups.
- Security governance still needs RBAC, audit logs, token expiry/revocation, key rotation, and stronger destructive-action confirmation.
- UI still needs more mobile, loading, error, and task-detail polish.

## Reference Projects

- `zhizhishu/flux-panel`: UI and forwarding-panel foundation reference.
- `MHSanaei/3x-ui`: target panel behavior and Xray management reference.
- `jinqians/snell.sh`: Snell deployment reference.
- `komari-monitor/komari`: master/agent control model inspiration.
