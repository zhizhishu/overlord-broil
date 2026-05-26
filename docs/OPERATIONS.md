# Operations

This checklist is for running Flux 3x-ui Orchestrator as a small authorized master/agent deployment.

## Install Paths

| Component | Path |
| --- | --- |
| Master install root | `/opt/flux-3xui-orchestrator` |
| Master environment | `/opt/flux-3xui-orchestrator/.env` |
| Master compose files | `/opt/flux-3xui-orchestrator/docker-compose.yml`, `docker-compose-v4.yml`, `docker-compose-v6.yml` or `docker-compose.sqlite.yml` |
| Database seed | `/opt/flux-3xui-orchestrator/gost.sql` |
| SQLite data directory | `/opt/flux-3xui-orchestrator/data`, only when `FLUX_DB_MODE=sqlite` |
| Master backups | `/opt/flux-3xui-orchestrator/backups` |
| Master logs volume | Docker volume `master_logs`, mounted at `/app/logs` |
| MySQL data volume | Docker volume `mysql_data` |
| Agent environment | `/etc/flux-agent.env` |
| Agent runner | `/usr/local/bin/flux-agent.sh` |
| Agent work directory | `/var/lib/flux-agent` |
| Snell node configs | `/etc/snell/users/node-<id>.conf` |
| Snell services | `snell-node-<id>.service` on systemd, `/etc/init.d/snell-node-<id>` on OpenRC |
| Forwarding services | `flux-forward-<id>.service` on systemd, `/etc/init.d/flux-forward-<id>` on OpenRC |

## Ports

| Port | Component | Production note |
| --- | --- | --- |
| `5166/tcp` | Master panel, API and controlled-agent callback | Default public entry. Change with `FLUX_FRONTEND_PORT`. |
| `6365/tcp` | Backend debug alias | Not exposed by default. Publish only with `FLUX_EXPOSE_BACKEND=1`. |
| `3306/tcp` | MySQL | Docker internal only in shipped compose files. |
| SQLite | Local DB file | Optional mode only; no network port. |
| phpMyAdmin | Maintenance UI | Disabled by default. Expose temporarily with `FLUX_PHPMYADMIN_PORT`. |

The installer removes legacy split-stack containers named `vite-frontend`, `springboot-backend` and `gost-phpmyadmin` during install/upgrade. This prevents old Flux-derived deployments from leaving public `80/6365/8066` ports active after the default runtime has moved to the single `flux-master` entry.

Controlled hosts do not need an inbound agent port. Agents call the same master entry URL that users open in the browser, for example `http://master:5166`.

Controlled-host business ports are created by your orchestration choices: optional 3x-ui panel port `5168`, Xray/Snell node ports, remote-forward listen ports and ACME HTTP `80/tcp` when selected.

## Linux Support Matrix

| Target | Debian / Ubuntu | Rocky / Oracle Linux | Alpine / OpenRC |
| --- | --- | --- | --- |
| Master Docker stack | Supported | Supported | Supported with bootstrap installer |
| Agent service | systemd | systemd | OpenRC |
| Snell node tasks | systemd | systemd | OpenRC |
| Remote forwarding tasks | systemd + `socat` | systemd + `socat` | OpenRC + `socat` |
| Full 3x-ui install/configure | Supported | Supported | Not supported in `0.6.0`; use a systemd host |

## Master Install And Upgrade

Install:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

Bootstrap form for Alpine or minimal images without `bash`:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master-bootstrap.sh | sudo sh
```

Preflight:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

Common overrides:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_FRONTEND_PORT="5166" FLUX_NETWORK_STACK="v4" bash

# optional SQLite mode for small labs or single-node trials
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_DB_MODE="sqlite" FLUX_FRONTEND_PORT="5166" bash
```

`FLUX_DB_MODE=mysql` is still the default and keeps the MySQL sidecar plus optional phpMyAdmin maintenance path. `FLUX_DB_MODE=sqlite` switches the master to `docker-compose.sqlite.yml`, disables phpMyAdmin, mounts `/opt/flux-3xui-orchestrator/data` into the `flux-master` container, and initializes the schema from the embedded SQLite schema on boot.

Day-2 actions:

```bash
sudo bash /opt/flux-3xui-orchestrator/install-master.sh upgrade
sudo bash /opt/flux-3xui-orchestrator/install-master.sh backup
sudo bash /opt/flux-3xui-orchestrator/install-master.sh restore --backup-file /opt/flux-3xui-orchestrator/backups/flux-master-backup-YYYYMMDD-HHMMSS.tar.gz
sudo bash /opt/flux-3xui-orchestrator/install-master.sh uninstall --yes
```

In SQLite mode, `backup` stores the resolved data directory as a separate `sqlite-data/` payload and `restore` writes it back to the `SQLITE_DATA_DIR` recorded in `.env`. If `flux-master` is running, the backup command briefly stops the master container before copying SQLite files, then starts it again for a consistent file-level backup.

Expose direct backend or phpMyAdmin only during maintenance:

```bash
sudo env FLUX_EXPOSE_BACKEND="1" FLUX_BACKEND_PORT="6365" bash /opt/flux-3xui-orchestrator/install-master.sh upgrade
sudo env FLUX_PHPMYADMIN_PORT="18066" bash /opt/flux-3xui-orchestrator/install-master.sh upgrade
```

Verify the single-entry contract from a checkout:

```bash
bash scripts/test-master-port-contract.sh
```

## Agent Operations

Install an agent on each controlled server:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://MASTER_IP:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash
```

Bootstrap form:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent-bootstrap.sh \
  | sudo env FLUX_PANEL_URL="http://MASTER_IP:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" sh
```

Useful checks:

```bash
systemctl status flux-agent.service
journalctl -u flux-agent.service -n 100 --no-pager
sudo -E /usr/local/bin/flux-agent.sh --doctor
sudo -E /usr/local/bin/flux-agent.sh --once

# Alpine / OpenRC
rc-service flux-agent status
tail -n 100 /var/log/flux-agent.log
tail -n 100 /var/log/flux-agent.err
```

Reliability knobs in `/etc/flux-agent.env`:

```bash
FLUX_HTTP_RETRIES=4
FLUX_HTTP_BACKOFF_BASE=2
FLUX_HTTP_BACKOFF_MAX=30
FLUX_HTTP_CONNECT_TIMEOUT=10
FLUX_HTTP_MAX_TIME=60
FLUX_TASK_TIMEOUT_SECONDS=7200
FLUX_TASK_TIMEOUT_KILL_SECONDS=30
```

## Runtime Provider Operations

Deployment tasks carry Runtime Provider metadata so operators can see which runtime owns the task and where state is expected to come from.

| Provider | Runtime boundary | Operational note |
| --- | --- | --- |
| `xui` | 3x-ui, Xray, Reality, inbounds, outbounds and traffic | Uses master-side 3x-ui API calls plus agent-executed inbound add/delete/restart tasks; avoid full orchestration on sub-200 MB hosts. |
| `snell` | Snell node services | Runs through agent-created systemd/OpenRC services and is the preferred proxy runtime for Nano hosts. |
| `forward` | Remote TCP/UDP forwarding | Runs through agent-created `socat` services and stays visible in the unified rule center. |
| `certificate` | Self-signed, ACME and certificate diagnostics | ACME HTTP mode needs DNS and `80/tcp`; diagnose before retrying failed issuance. |
| `firewall` | Runtime port diagnostics, opening and closing | Applies local `ufw`, `firewalld` or `iptables` runtime-port changes when requested; cloud security groups still need manual confirmation. |

Failed or timed-out deployment tasks should be retried from the task card rather than edited in place. The retry endpoint creates a new `generated` task with the same script, stores `retryFromTaskId` in `request_json`, and reattaches Runtime Provider metadata so the original stdout/stderr remains auditable.

Agent reports store a normalized `resultJson.runtimeState` block beside `resultJson.runtimeProvider`. Operators should read `runtimeState.status` with `runtimeState.statusSource`: failed or timed-out task states win first, then provider service state, protocol-node state, forwarding-rule state, certificate state, diagnostic summary and finally the task state fallback. This keeps XUI, Snell, forwarding, certificate and firewall tasks comparable in the master task card.

The State Sync overview endpoint, `/api/v1/deploy-task/runtime-state/overview`, aggregates the latest `runtimeState` task result per server/provider and fills gaps from `control_server` heartbeat fields. The master UI shows that data as a compact State Sync panel so operators can compare XUI/Xray, Snell and certificate health across all registered servers without opening each task card.

State Sync row actions reuse the existing `agent-maintenance` task path instead of introducing a second executor. The runtime doctor button maps the provider to the most relevant diagnostic action (`install-diagnose`, `cert-diagnose`, `firewall-diagnose` or `doctor`), while XUI/Snell repair buttons generate `repair-xui`, `repair-xray` or `repair-snell` tasks with the source runtime metadata preserved in `request_json`.

Runtime Provider descriptors expose an Action Catalog for these `agent-maintenance` operations. Treat that catalog as the supported action contract: backend validation, State Sync row shortcuts and server-card Agent buttons should all derive from it so new provider actions have a single auditable registration point.

Dangerous Action Catalog entries require explicit confirmation before they enter the controlled-agent queue. The master UI asks the operator to confirm, and the backend rejects dangerous `agent-maintenance` tasks unless `request_json` includes `dangerConfirmed=true` and `confirmAction=<action>`. Current dangerous actions include agent uninstall and runtime-port closure.

Task claiming is guarded by an atomic state transition: the agent can only move a task from `generated` to `claimed` when the row still belongs to the same server and still has `state=generated`. If another agent loop wins the race, the loser receives no task and polls again instead of executing the same script twice.

Xray/3x-ui deployment scripts are now executable by the controlled agent. They resolve `XUI_ENDPOINT`, `XUI_BASE_PATH` and `XUI_API_TOKEN` from saved server metadata or local agent environment, call `/panel/api/inbounds/add`, `/panel/api/inbounds/del/{id}` or `/panel/api/server/restartXrayService`, and report inbound metadata through `FLUX_AGENT_RESULT_JSON`. A missing API token should be treated as an operator configuration error unless the target host can read it from `/usr/local/x-ui/x-ui`.

Agent reports are sanitized before task-history storage. Raw installation/orchestration reports may contain new 3x-ui credentials long enough for the master to update encrypted server fields, but stored `resultJson` removes `xuiApiToken`, `xuiPassword`, `xuiTwoFactorCode` and any `serverSecrets` block, replacing them with configured flags where useful.

Firewall actions `open-runtime-ports` and `close-runtime-ports` parse `ports`, `runtimePorts`, `listenPort`, `panelPort`, protocol-specific ports and `acme-http` mode from `request_json`. The generated agent script applies local firewall rules through `ufw`, active `firewalld`, or `iptables`, then runs firewall diagnostics again. Local success still does not prove that the cloud security group permits the port.

Install, certificate and firewall diagnostics write structured `diagnostics.items` into the task result. The master task card summarizes high-risk findings first: unresolved DNS, local port `80` occupancy, missing certificate files, missing ACME tooling, local firewall command availability and the cloud-security-group boundary.

`agent-maintenance` log collection writes structured `logs.items` into the task result. Each item carries `runtime`, `source`, `title`, bounded `content`, line count and truncation state. The intended coverage is Flux agent runtime logs, x-ui/Xray service logs, Snell node service logs, remote forwarding service logs and task/work-directory logs. The master task card should use these items for a short remote-log summary first, then leave raw stdout/stderr available for deeper investigation.

`agent-maintenance upgrade-agent` uses a guarded upgrade path. The generated script downloads the new `flux-agent.sh` to a temporary file, rejects empty or syntactically invalid downloads before touching the current binary, records the current and new `--version` values, calculates SHA-256 when a local checksum tool is available, backs up the previous binary as `flux-agent.sh.bak.<timestamp>`, installs through a staged file, schedules a service restart, and reports the result under `maintenance.upgrade`.

## First-Run Operator Path

1. Register the master and controlled servers in the asset list.
2. Copy each server token and install the controlled agent.
3. Wait for agent heartbeat before sending orchestration tasks.
4. Run one-click orchestration for 3x-ui, Xray starter nodes, Snell and certificates.
5. Sync 3x-ui inbounds/outbounds, Snell nodes, remote forwards and traffic snapshots into the unified rule center.
6. Review critical alerts, run certificate/firewall diagnostics, back up `.env`, then expose only the intended public ports.

## Operational Checklist

- Confirm `.env` has non-default `JWT_SECRET` and `SECRET_ENCRYPTION_KEY`; MySQL mode also needs a non-default `DB_PASSWORD`.
- Back up `SECRET_ENCRYPTION_KEY` with `.env`; encrypted 3x-ui credentials and API tokens cannot be restored safely if the key is lost or rotated without planning.
- Keep controlled-server agents off the master host unless you are deliberately testing self-control behavior. A `role=master` server can self-manage safe tasks, while destructive actions and protected listen ports such as frontend/backend/MySQL/SSH are blocked.
- Confirm only `5166/tcp` is publicly reachable for the master unless you intentionally exposed debug or maintenance ports.
- Confirm `docker compose ps` shows healthy `mysql` and `master` services in MySQL mode, or a healthy `master` service plus `/opt/flux-3xui-orchestrator/data` in SQLite mode.
- Check `GET /flow/test` through the master entry after every upgrade.
- Create a backup before upgrades and before schema-affecting changes.
- Store 3x-ui API tokens only in the panel fields intended for that purpose; do not paste tokens into issue reports or logs.
- Rotate each controlled-server agent token after handoff or suspected exposure.
- Verify agent heartbeats before sending orchestration, Snell or forwarding tasks.
- Treat hosts below `256 MB` as Nano nodes. Hosts below `200 MB` should only receive Snell or remote-forwarding tasks until swap and real-host testing prove they can survive 3x-ui/Xray.
- Send full 3x-ui install/configure orchestration only to normal systemd hosts. Alpine/OpenRC controlled hosts can run agent, Snell and forwarding tasks, but the upstream 3x-ui installation path is blocked by preflight.
- For ACME HTTP certificate mode, run certificate and firewall diagnostics before retrying. The task card should distinguish DNS, local port `80`, certificate-file state, local firewall rules and cloud security-group exposure.
- Verify duplicate protocol and forwarding ports before deploying to a shared host.
- Review task stdout/stderr before retrying failed deployment tasks.
- Review monitor alerts after every orchestration batch; acknowledge only after the remote condition has been checked.
- Keep GHCR package visibility and tag policy aligned with the public README commands.

## Release Readiness

Release readiness means:

- `VERSION`, `README.md`, release notes and the public docs site name the same release.
- CI is green on `main`.
- Docker Images workflow is green on `main` and GHCR has a fresh `flux-master` image.
- GHCR package visibility is public or otherwise intentionally scoped, and `docker pull ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` works from the intended install environment.
- `scripts/install-master.sh` succeeds on a clean Linux host or falls back to local source builds when GHCR pulls are unavailable.
- `scripts/install-master-bootstrap.sh` and `scripts/install-flux-agent-bootstrap.sh` are syntax-checked.
- `scripts/test-install-matrix.sh` passes on Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux container images.
- `.env` and backup handling are understood before the first live install.
- Public firewall rules intentionally expose only the ports needed for your environment.
- The release notes clearly state whether the release was verified through Docker/CI only or through real VPS hosts.

## Local And CI Verification

```bash
docker run --rm -v "$PWD/springboot-backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -DskipTests package
docker run --rm -v "$PWD:/workspace" -v flux_3xui_frontend_node_modules:/workspace/vite-frontend/node_modules -w /workspace/vite-frontend node:22-bookworm bash -lc "npm install --legacy-peer-deps --no-audit --no-fund && npm run build"
bash scripts/release-check.sh
bash scripts/release-check.sh --full
bash scripts/test-flux-agent-mock.sh
bash scripts/test-three-xui-fixture.sh
bash scripts/test-three-xui-e2e.sh
bash scripts/test-install-matrix.sh
bash scripts/test-compose-smoke.sh --build-local --dry-run
bash scripts/test-compose-smoke.sh --build-local
bash scripts/test-sqlite-schema.sh
bash scripts/test-compose-smoke.sh --compose-file docker-compose.sqlite.yml --build-local --dry-run
bash scripts/test-compose-smoke.sh --compose-file docker-compose.sqlite.yml --build-local
```

The 3x-ui fixture test uses a short-lived local Python HTTP server and exits without leaving ports open. The real 3x-ui E2E script is a gated contract smoke: it exits as skipped unless `THREE_XUI_E2E_URL` and `THREE_XUI_E2E_TOKEN` are set, and write checks require `THREE_XUI_E2E_WRITE=1` plus `THREE_XUI_E2E_PORT`. The install matrix is useful shell portability coverage, but it is not a substitute for a real VPS matrix with systemd/OpenRC, cloud firewall and public DNS. The full compose smoke test should remove its disposable containers, network and volumes when it exits.

Manual real 3x-ui read-only check:

```bash
export THREE_XUI_E2E_URL="https://xui.example.com:5168"
export THREE_XUI_E2E_TOKEN="YOUR_3XUI_API_TOKEN"
bash scripts/test-three-xui-e2e.sh
```

Manual real 3x-ui write check:

```bash
THREE_XUI_E2E_WRITE=1 THREE_XUI_E2E_PORT=42123 bash scripts/test-three-xui-e2e.sh
```
