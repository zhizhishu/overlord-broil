# Flux 3x-ui Orchestrator

[中文说明](README.zh-CN.md)

Flux 3x-ui Orchestrator is a control-panel project based on the Flux Panel UI and forwarding-panel foundation. It provides a master/agent orchestration panel for managing multiple servers, deploying 3x-ui compatible protocol nodes, and operating Snell alongside Xray-based nodes.

This repository is an independent project. It uses upstream projects as references and foundations, but future development should happen here.

Project site:

```text
https://zhizhishu.github.io/flux-3xui-orchestrator/
https://zhizhishu.github.io/
```

Current release: `0.6.0` (reliability release candidate for public trial and small master/agent deployments).

Release and operations docs:

- [Release notes](docs/RELEASE_NOTES.md)
- [Operations checklist](docs/OPERATIONS.md)

## UI Preview

![Flux 3x-ui Orchestrator control plane](docs/assets/flux-orchestrator-screenshot.svg)

The master panel keeps the Flux Panel direction: dense server cards, grouped operations, compact status chips and one unified rule view. The UI is meant for repeated operations rather than marketing pages: select one or many servers, generate agent tasks, manage 3x-ui inbound/outbound rules, run Snell as a managed protocol node, sync traffic and check certificate/service status from the same surface.

The current product UI is Chinese-first by default and now includes a `zh-CN` / `en-US` language switch in the main layouts. The switch persists in local storage, updates the document language, and currently covers the master control center, server cards, orchestration modal, 3x-ui operations, Snell nodes, remote forwarding rules, agent maintenance actions and the main navigation. Older Flux forwarding pages can continue to be translated in batches on top of the same dictionary.

## Production Release Gate

Before publishing a release tag or installing on a live host, run:

```bash
bash scripts/release-check.sh --full
```

The release gate validates shell scripts, agent task execution, tokenized 3x-ui fixture routes, compose v4/v6 config, frontend production build, Docker Maven backend build, multi-distribution installer diagnostics, a disposable compose smoke stack and `git diff --check`.

Formal runtime assumptions for this release:

- Use a fresh Linux host or a host where ports `5166` and `6365` are either free or intentionally remapped.
- Supported master hosts are Docker-capable Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux. Minimal hosts without `bash` can use the bootstrap commands below.
- Full 3x-ui install/configure orchestration requires a normal systemd host, such as Debian, Ubuntu, Rocky Linux or Oracle Linux. Alpine/OpenRC is supported for the Flux agent, Snell tasks and remote port-forward tasks, but not for upstream 3x-ui service installation.
- Keep `/opt/flux-3xui-orchestrator/.env` and backups private; it contains `DB_PASSWORD`, `JWT_SECRET` and `SECRET_ENCRYPTION_KEY`.
- Keep `SECRET_ENCRYPTION_KEY` stable. It encrypts stored agent tokens and 3x-ui API/password/2FA fields.
- phpMyAdmin is not exposed by default. Only expose it temporarily with `FLUX_PHPMYADMIN_PORT` or `--phpmyadmin-port`, and restrict it with a firewall.
- Register controlled servers only when you own or are authorized to administer them.

Default master ports:

| Port | Component | Notes |
| --- | --- | --- |
| `5166` | Frontend panel | Change with `FLUX_FRONTEND_PORT`; this intentionally avoids occupying `80`. |
| `6365` | Backend API / agent callback | Change with `FLUX_BACKEND_PORT`. |
| disabled | phpMyAdmin | Internal container service only by default; set `FLUX_PHPMYADMIN_PORT` or `--phpmyadmin-port` to expose it temporarily. |
| `3306` | MySQL | Container-internal only; not published to the host. |

Controlled-server ports are created by your orchestration choices: default 3x-ui panel port `5168`, Xray inbound ports, Snell listen ports, remote-forward listen ports and ACME HTTP `80` when that certificate mode is used.

Linux support matrix:

| Target | Debian / Ubuntu | Rocky / Oracle Linux | Alpine / OpenRC |
| --- | --- | --- | --- |
| Master Docker stack | Supported via `apt-get` + Docker install | Supported via `dnf`/`yum` + Docker install | Supported via `apk` + OpenRC Docker service |
| Agent service | systemd | systemd | OpenRC |
| Snell node tasks | systemd service | systemd service | OpenRC service |
| Remote forwarding tasks | systemd + `socat` | systemd + `socat` | OpenRC + `socat` |
| Full 3x-ui install/configure | Supported | Supported | Not supported in `0.6.0`; use a systemd host for this part |

## Formal Release Gap

Current status: `0.6.0` is a public-trial reliability release candidate. It is suitable for self-hosted testing and small authorized master/agent deployments, but it is intentionally not marketed as a broad `1.0` long-term compatibility release yet.

The main gaps before a formal `1.0` are:

1. Real VPS matrix verification: run fresh Debian, Ubuntu, Rocky Linux, Oracle Linux and Alpine hosts through master install, agent install, 3x-ui orchestration, Snell deployment, traffic sync, certificate handling, restart and uninstall.
2. Real 3x-ui end-to-end smoke: the repository already has an API-level 3x-ui fixture; the next gate should add a real 3x-ui container or real VPS target for inbound/outbound/config/traffic/restart flows.
3. Snell boundary clarity: Snell is unified in the product layer and deployed by the Flux agent as a managed runtime service. It is not a native Xray/3x-ui core protocol, so docs and UI must keep that distinction explicit.
4. Certificate and firewall diagnostics: ACME HTTP mode depends on DNS, port `80`, local firewall and cloud security groups. Failure messages should be more specific before broad production use.
5. Security governance: add RBAC, visible audit logs, agent token expiry/revocation, planned encryption-key rotation and second confirmation for destructive operations.
6. UI finish: continue polishing the Flux-style operations console, especially mobile layout, empty/loading/error states, modal validation and human-readable task failures.
7. Operations loop: add agent self-upgrade verification, one-click health repair, remote log pull retention, configurable retry policy and stronger service recovery checks.

Planned `future` branch direction:

- P0: real VPS matrix plus real 3x-ui E2E smoke.
- P1: agent upgrade, repair and log-pull hardening.
- P2: RBAC, audit log and token lifecycle management.
- P3: UI/mobile polish, clearer errors and release screenshots.

## Quick Start

The repository is public, so the installer can be fetched directly from GitHub raw files.

Master panel one-click install, using the GHCR images built by GitHub Actions:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

On Alpine or a very small image that does not have `bash` yet, use the POSIX bootstrap first:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master-bootstrap.sh | sudo sh
```

The default action is still `install`. For day-2 operations, pass an explicit action:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash -s -- upgrade
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash -s -- backup
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash -s -- restore --backup-file /opt/flux-3xui-orchestrator/backups/flux-master-backup-YYYYMMDD-HHMMSS.tar.gz
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash -s -- uninstall --yes
```

`upgrade` creates a backup before refreshing compose/sql files and restarting. `backup` stores `.env`, compose, `gost.sql`, and a MySQL logical dump when the database container is running. `uninstall` removes stack containers only; it keeps the install directory and Docker volumes.

If the GHCR packages are not public yet, pass a GitHub token with `read:packages` so Docker can pull the images:

```bash
export GITHUB_TOKEN="github-token-with-read-packages"
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env GHCR_USERNAME="zhizhishu" GHCR_TOKEN="${GITHUB_TOKEN}" bash
```

Common options:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_FRONTEND_PORT="5166" FLUX_BACKEND_PORT="6365" FLUX_NETWORK_STACK="v4" bash
```

phpMyAdmin is not publicly exposed by default. Expose it only for maintenance:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_PHPMYADMIN_PORT="18066" bash
```

The installer downloads `docker-compose-v4.yml` or `docker-compose-v6.yml`, downloads `gost.sql`, creates `/opt/flux-3xui-orchestrator/.env`, pulls the backend/frontend images and starts the stack. If GHCR is not public yet or pull fails, it falls back to downloading the public GitHub source archive and building both images locally.

Before installing on a live host, run the non-destructive master preflight:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

The doctor checks OS/package manager detection, Docker/Compose availability, Docker daemon reachability, requested ports and existing `.env` values. In CI or a container where Docker is intentionally unavailable:

```bash
FLUX_DOCTOR_REQUIRE_DOCKER=0 bash scripts/install-master.sh doctor
```

Controlled server agent one-command install:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://your-master-panel:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash
```

Alpine or minimal controlled hosts can use the agent bootstrap:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent-bootstrap.sh \
  | sudo env FLUX_PANEL_URL="http://your-master-panel:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" sh
```

`FLUX_SERVER_ID` and `FLUX_AGENT_TOKEN` come from `主控中心`: create or open the server card, then click `Token`.

Before installing a controlled host, run the agent preflight:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://your-master-panel:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash -s -- doctor
```

After install, the local agent can diagnose itself:

```bash
sudo env FLUX_PANEL_URL="http://your-master-panel:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" \
  /usr/local/bin/flux-agent.sh --doctor
```

## Project Direction

- Use `flux-panel` as the UI and forwarding-panel base.
- Add a master-control workspace for managing multiple servers.
- Add agent/secondary-control concepts for server registration, heartbeats, and deployment status.
- Bring in 3x-ui style protocol management for Xray-based nodes.
- Add Snell support through non-interactive deployment scripts and a lightweight agent executor.
- Keep deployment workflows auditable: generate tasks on the master side, then let an authorized agent pull, execute, and report results.

## Current Release Scope

The current public release includes:

- Control server registry:
  - server CRUD
  - agent token generation and rotation
  - heartbeat endpoint
  - runtime status fields for 3x-ui/Xray/Snell/certificate/CPU/memory/traffic
  - 3x-ui panel connection fields: endpoint, base path, API token, optional login credentials
  - remote server rule overview for 3x-ui inbounds, 3x-ui outbounds, protocol nodes and port forwards
- Protocol profiles:
  - Snell
  - VLESS / VMess / Trojan / Shadowsocks starter templates
- Deployment tasks:
  - generated task records
  - generated Snell install/restart/status/uninstall script
  - unified `protocol_node` records for Xray/3x-ui inbounds and Snell services
  - remote `server_forward_rule` records that install/update/delete systemd/OpenRC + `socat` port-forward services on controlled servers
  - one-click 3x-ui orchestration task for installing/configuring 3x-ui, creating starter protocol nodes, installing Snell and returning connection metadata
  - agent task claim/report API protected by `X-Agent-Token`
  - `scripts/install-master.sh` one-click master installer for GHCR + Docker Compose deployment
  - `scripts/flux-agent.sh` polling executor for副控 servers
  - `scripts/install-flux-agent.sh` one-command systemd/OpenRC installer for long-running agents
  - `doctor` preflight commands for master installer, agent installer and the local agent runtime
  - agent maintenance tasks for remote `doctor`, `logs`, `restart-agent` and `upgrade-agent` actions through the existing claim/report channel
- 3x-ui remote panel management:
  - test remote 3x-ui connection
  - list inbounds through `/panel/api/inbounds/list`
  - add / update / delete inbounds through the real 3x-ui API
  - add / update / delete inbound clients and reset client traffic through backend API endpoints
  - read full Xray config and extract outbounds
  - read outbound traffic through `/panel/xray/getOutboundsTraffic`
  - sync inbound, client and outbound traffic into local `three_xui_traffic_snapshot`
  - scheduled 5-minute traffic sync for registered servers with 3x-ui API tokens
  - save full Xray / outbound config through 3x-ui login + CSRF when credentials are configured
  - restart remote Xray through `/panel/api/server/restartXrayService`
- Frontend workspace:
  - new `主控中心` page
  - server cards
  - unified protocol node cards for Xray and Snell
  - remote port-forward cards for each controlled server
  - protocol profile cards
  - deployment task cards
  - structured 3x-ui inbound form for VLESS Reality, VMess WS, Trojan TLS and Shadowsocks
  - advanced JSON fallback for inbound payloads
  - 3x-ui inbound/outbound operation modals
  - remote traffic sync and local traffic snapshot viewer
  - one-click orchestration modal for 3x-ui, Reality, VMess WS, Trojan TLS, Shadowsocks and Snell
  - service/certificate/traffic status chips on server cards
  - server-card `Agent` action group for remote diagnostics, logs, restart and upgrade tasks
  - monitor alert center for agent offline, certificate expiry, service failures, task failures/timeouts and traffic anomalies
  - unified rule center for protocol nodes, remote forwards and 3x-ui traffic snapshots with search and filters
  - script, token, inbound and config viewers
- GitHub Actions:
  - CI builds backend Maven package and frontend production bundle
  - CI runs agent mock tests, tokenized 3x-ui fixture checks, compose validation and a disposable Docker compose smoke test built from the current checkout
  - Docker image workflow builds backend and frontend images
  - pushes images to GitHub Container Registry on `main`, tags and manual dispatch

## Capability Matrix

| Area | Current public repo capability |
| --- | --- |
| Master install | One-command GitHub raw installer, default install path `/opt/flux-3xui-orchestrator`. |
| Master runtime | Docker Compose stack with MySQL, backend, frontend and optional phpMyAdmin. |
| Images | GHCR backend/frontend images with local source-build fallback when package pulls are unavailable. |
| Agent install | One-command systemd/OpenRC installer; config in `/etc/flux-agent.env`, runner at `/usr/local/bin/flux-agent.sh`. |
| Agent tasks | Poll, execute, timeout, retry and report flow for Snell, 3x-ui orchestration and port-forward tasks. |
| Agent maintenance | Remote doctor/log/restart/upgrade task generation from the server card. |
| 3x-ui | Connection test, inbound/client operations, Xray config/outbound reads, traffic sync and Xray restart. |
| Snell | Managed as a product-level protocol node through agent-generated systemd/OpenRC services. |
| Port forwards | Controlled-host `socat` services created through auditable deployment tasks. |
| Verification | Maven package, Vite build, agent mock test, tokenized 3x-ui fixture, compose config, multi-distribution install doctor matrix and disposable compose smoke test. |

## Repository Layout

```text
.
├── springboot-backend/     # Spring Boot backend
├── vite-frontend/          # React + Vite + HeroUI frontend
├── scripts/                # Master installer and lightweight flux agent executor
├── go-gost/                # Existing forwarding/node component from Flux Panel
├── vitepress/              # Existing documentation site
├── gost.sql                # Database schema seed
└── TASK_LOG.md             # Local handoff/task log for ongoing development
```

Local-only reference repositories are kept in `_references/` and ignored by Git.

## Important Paths

- Backend controllers:
  - `springboot-backend/src/main/java/com/admin/controller/ControlServerController.java`
  - `springboot-backend/src/main/java/com/admin/controller/AgentTaskController.java`
  - `springboot-backend/src/main/java/com/admin/controller/ProtocolProfileController.java`
  - `springboot-backend/src/main/java/com/admin/controller/DeployTaskController.java`
  - `springboot-backend/src/main/java/com/admin/controller/ThreeXuiController.java`
- Backend services:
  - `springboot-backend/src/main/java/com/admin/service/impl/ControlServerServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/ProtocolProfileServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/DeployTaskServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/SnellTemplateServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/ThreeXuiServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/XuiOrchestrationScriptServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/common/task/ThreeXuiTrafficSyncTask.java`
- Frontend page:
  - `vite-frontend/src/pages/orchestrator.tsx`

## How To Use

### 1. Prepare the database

For a fresh database, import `gost.sql`.

For an existing database created before the 3x-ui connector fields were added, run:

```sql
ALTER TABLE `control_server`
  ADD COLUMN `xui_endpoint` varchar(255) DEFAULT NULL AFTER `host`,
  ADD COLUMN `xui_base_path` varchar(100) DEFAULT NULL AFTER `xui_endpoint`,
  ADD COLUMN `xui_api_token` varchar(512) DEFAULT NULL AFTER `xui_base_path`,
  ADD COLUMN `xui_username` varchar(100) DEFAULT NULL AFTER `xui_api_token`,
  ADD COLUMN `xui_password` varchar(512) DEFAULT NULL AFTER `xui_username`,
  ADD COLUMN `xui_two_factor_code` varchar(255) DEFAULT NULL AFTER `xui_password`,
  ADD COLUMN `xui_allow_insecure` int(1) NOT NULL DEFAULT '0' AFTER `xui_two_factor_code`,
  ADD COLUMN `xui_last_sync` bigint(20) DEFAULT NULL AFTER `xui_allow_insecure`,
  ADD COLUMN `xui_service_status` varchar(30) DEFAULT NULL AFTER `snell_version`,
  ADD COLUMN `xray_service_status` varchar(30) DEFAULT NULL AFTER `xui_service_status`,
  ADD COLUMN `snell_service_status` varchar(30) DEFAULT NULL AFTER `xray_service_status`,
  ADD COLUMN `certificate_mode` varchar(30) DEFAULT NULL AFTER `snell_service_status`,
  ADD COLUMN `certificate_domain` varchar(255) DEFAULT NULL AFTER `certificate_mode`,
  ADD COLUMN `certificate_status` varchar(30) DEFAULT NULL AFTER `certificate_domain`,
  ADD COLUMN `certificate_expire_at` bigint(20) DEFAULT NULL AFTER `certificate_status`;

CREATE TABLE `three_xui_traffic_snapshot` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `server_id` int(10) NOT NULL,
  `server_name` varchar(100) DEFAULT NULL,
  `source_type` varchar(30) NOT NULL,
  `inbound_id` int(10) DEFAULT NULL,
  `inbound_remark` varchar(255) DEFAULT NULL,
  `protocol` varchar(50) DEFAULT NULL,
  `tag` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `client_id` varchar(255) DEFAULT NULL,
  `up` bigint(20) NOT NULL DEFAULT '0',
  `down` bigint(20) NOT NULL DEFAULT '0',
  `total` bigint(20) NOT NULL DEFAULT '0',
  `expiry_time` bigint(20) DEFAULT NULL,
  `enable` int(1) DEFAULT NULL,
  `synced_time` bigint(20) NOT NULL,
  `raw_json` longtext,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) DEFAULT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  KEY `source_type` (`source_type`),
  KEY `synced_time` (`synced_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `monitor_alert` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `server_id` int(10) NOT NULL,
  `server_name` varchar(100) DEFAULT NULL,
  `alert_type` varchar(50) NOT NULL,
  `severity` varchar(30) NOT NULL DEFAULT 'warning',
  `source` varchar(50) NOT NULL,
  `message` varchar(255) NOT NULL,
  `detail_json` longtext,
  `first_seen_at` bigint(20) NOT NULL,
  `last_seen_at` bigint(20) NOT NULL,
  `acknowledged` int(1) NOT NULL DEFAULT '0',
  `acknowledged_time` bigint(20) DEFAULT NULL,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) DEFAULT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  KEY `alert_type` (`alert_type`),
  KEY `acknowledged` (`acknowledged`),
  KEY `last_seen_at` (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `protocol_node` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `server_id` int(10) NOT NULL,
  `server_name` varchar(100) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `protocol` varchar(50) NOT NULL,
  `engine` varchar(50) NOT NULL,
  `direction` varchar(30) NOT NULL DEFAULT 'inbound',
  `listen` varchar(100) DEFAULT NULL,
  `port` int(10) DEFAULT NULL,
  `transport` varchar(50) DEFAULT NULL,
  `security` varchar(50) DEFAULT NULL,
  `credential_json` longtext,
  `config_json` longtext,
  `remote_id` varchar(100) DEFAULT NULL,
  `service_name` varchar(100) DEFAULT NULL,
  `state` varchar(50) DEFAULT NULL,
  `up` bigint(20) NOT NULL DEFAULT '0',
  `down` bigint(20) NOT NULL DEFAULT '0',
  `total` bigint(20) NOT NULL DEFAULT '0',
  `last_sync` bigint(20) DEFAULT NULL,
  `last_error` longtext,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) DEFAULT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  KEY `engine` (`engine`),
  KEY `protocol` (`protocol`),
  KEY `remote_id` (`remote_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `server_forward_rule` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `server_id` int(10) NOT NULL,
  `server_name` varchar(100) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `protocol` varchar(20) NOT NULL DEFAULT 'tcp',
  `listen_host` varchar(100) DEFAULT '0.0.0.0',
  `listen_port` int(10) NOT NULL,
  `target_host` varchar(255) NOT NULL,
  `target_port` int(10) NOT NULL,
  `engine` varchar(50) DEFAULT 'socat',
  `service_name` varchar(100) DEFAULT NULL,
  `state` varchar(50) DEFAULT NULL,
  `up` bigint(20) NOT NULL DEFAULT '0',
  `down` bigint(20) NOT NULL DEFAULT '0',
  `last_sync` bigint(20) DEFAULT NULL,
  `last_error` longtext,
  `created_time` bigint(20) NOT NULL,
  `updated_time` bigint(20) DEFAULT NULL,
  `status` int(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  KEY `listen_port` (`listen_port`),
  KEY `service_name` (`service_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

If those 3x-ui columns already exist from an older checkout, widen the encrypted fields before saving new credentials:

```sql
ALTER TABLE `control_server`
  MODIFY COLUMN `xui_api_token` varchar(512) DEFAULT NULL,
  MODIFY COLUMN `xui_password` varchar(512) DEFAULT NULL,
  MODIFY COLUMN `xui_two_factor_code` varchar(255) DEFAULT NULL;
```

### 2. Create a 3x-ui API token

On each remote 3x-ui panel, create or print an API token. Recent 3x-ui exposes Bearer-token auth for `/panel/api/*`.

You can usually create one from 3x-ui settings, or on the remote server through the 3x-ui command line:

```bash
x-ui setting -getApiToken
```

### 3. Register the server in this panel

Open `主控中心` and click `添加服务器`.

Fill:

- `主机`: the server host or IP for your own reference.
- `3x-ui 面板地址`: for example `https://1.2.3.4:5168`.
- `3x-ui Base Path`: only fill this when the remote 3x-ui panel uses a custom web base path, for example `/secret-path`.
- `3x-ui API Token`: required for inbound list/add/update/delete, client operations, Xray config read and Xray restart.
- `3x-ui 用户名` and `3x-ui 密码`: optional, but required when saving full Xray/outbound settings and reading outbound traffic because 3x-ui keeps `/panel/xray/*` behind login session + CSRF.
- `3x-ui TLS 校验`: choose `允许自签名` only when the remote panel uses a self-signed certificate.

### 4. Start a副控 agent

After a server is created, click `Token` on the server card and put the returned token on that server.

For a long-running agent, run this on the controlled server:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="https://your-master-panel.example.com" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash
```

The installer downloads `scripts/flux-agent.sh`, creates `/etc/flux-agent.env`, installs `/usr/local/bin/flux-agent.sh`, and keeps the副控 online through systemd or OpenRC. It also installs `bash`, `curl` and `python3` when the OS package manager is available.

If you already copied the scripts to the server, local install still works:

```bash
export FLUX_PANEL_URL="https://your-master-panel.example.com"
export FLUX_SERVER_ID="1"
export FLUX_AGENT_TOKEN="paste-agent-token-here"
sudo -E bash ./install-flux-agent.sh ./flux-agent.sh
```

For foreground testing:

```bash
export FLUX_PANEL_URL="https://your-master-panel.example.com"
export FLUX_SERVER_ID="1"
export FLUX_AGENT_TOKEN="paste-agent-token-here"
sudo -E bash ./flux-agent.sh
```

For one-shot testing:

```bash
sudo -E bash ./flux-agent.sh --once
```

The agent polls `POST /api/v1/agent-task/claim`, writes the claimed Snell/Xray script to `/var/lib/flux-agent`, executes it locally, and reports `running/succeeded/failed` plus stdout/stderr through `POST /api/v1/agent-task/report`.

The master can also generate agent maintenance tasks from each server card:

- `诊断`: runs `/usr/local/bin/flux-agent.sh --doctor` remotely and reports structured status.
- `日志`: collects recent systemd/OpenRC logs and recent `/var/lib/flux-agent/task-*.out|err` files.
- `安装诊断`: checks the installed binary, env file, service manager, work directory, token presence and current agent service status.
- `证书诊断`: checks ACME/DNS/port-80/certificate clues and reports user-readable causes such as `DNS 未解析` or `80 端口被占用`.
- `防火墙诊断`: prints port-80 listeners plus ufw/firewalld/nftables/iptables summaries and reminds you to verify cloud security groups.
- `重启`: schedules a delayed `flux-agent` service restart so the task can report before the daemon restarts.
- `升级`: downloads the current `scripts/flux-agent.sh` from this repository, syntax-checks it, replaces the local runner and schedules a restart.
- `一键修复`: restarts/repairs the detected 3x-ui, Xray and Snell services through systemd/OpenRC where available.
- `卸载 agent`: schedules a delayed removal of the agent service, env file and runner after the current task report returns.

Failed or timed-out deployment tasks can be retried from the task card. The retry creates a new `generated` task with the same script and a `retryFromTaskId` record, so the original failure log remains intact.

Useful agent reliability knobs:

```bash
export FLUX_HTTP_RETRIES=4
export FLUX_HTTP_BACKOFF_BASE=2
export FLUX_HTTP_BACKOFF_MAX=30
export FLUX_HTTP_CONNECT_TIMEOUT=10
export FLUX_HTTP_MAX_TIME=60
export FLUX_TASK_TIMEOUT_SECONDS=7200
export FLUX_TASK_TIMEOUT_KILL_SECONDS=30
export FLUX_PYTHON_BIN=/usr/bin/python3
export FLUX_BASH_BIN=/bin/bash
```

The agent keeps a single-host lock, retries temporary HTTP failures with backoff, reports task stdout/stderr/result metadata, and marks long-running task scripts as failed with `exitCode=124` when they exceed `FLUX_TASK_TIMEOUT_SECONDS`.

Service commands:

```bash
# systemd hosts: Debian, Ubuntu, Rocky Linux, Oracle Linux
systemctl status flux-agent.service
journalctl -u flux-agent.service -n 100 --no-pager

# OpenRC hosts: Alpine
rc-service flux-agent status
tail -n 100 /var/log/flux-agent.log
tail -n 100 /var/log/flux-agent.err
```

### 5. One-click 3x-ui orchestration

Open `主控中心`, click `一键编排`, choose one or more servers, then choose:

- whether to install or reuse 3x-ui
- panel port, username, password and web base path
- certificate mode: self-signed, ACME HTTP or none
- protocols to create: VLESS Reality, VMess WebSocket, Trojan TLS and Shadowsocks
- whether to install Snell

Click `生成一键任务`. The master creates one deployment task per selected server. Each remote agent claims its own task automatically, installs/configures 3x-ui, creates the selected protocol nodes, installs Snell when selected, restarts services, then returns 3x-ui endpoint/base path/API token, service status, certificate status and created inbound metadata. The server card updates after the task report or next heartbeat.

The one-click 3x-ui script validates duplicate ports before it is saved and requires a running systemd host because upstream 3x-ui ships systemd service units. Use Debian, Ubuntu, Rocky Linux or Oracle Linux for full 3x-ui installation/configuration. Alpine/OpenRC can still run the Flux agent, Snell node tasks and remote forwarding tasks, but the full 3x-ui install step is intentionally blocked with a clear preflight error.

ACME HTTP mode requires the domain DNS to point at the target server and port `80` to be reachable. The current script uses standalone HTTP validation and expects the host firewall/cloud firewall to allow the challenge traffic. Use `Agent / 证书诊断` and `Agent / 防火墙诊断` before retrying failed ACME tasks; the report calls out DNS, port occupancy, local firewall and cloud-firewall boundaries explicitly.

### 6. Manage unified protocol nodes

Open `主控中心` and use `新增节点`.

- VLESS / VMess / Trojan / Shadowsocks nodes are created through the remote 3x-ui inbound API and stored locally in `protocol_node`.
- Snell nodes are stored in `protocol_node`, then the master creates an agent task. The remote agent installs or updates a node-specific Snell systemd/OpenRC service such as `snell-node-12.service`, writes `/etc/snell/users/node-12.conf`, starts the service, and reports the final service status plus generated PSK back to the master.
- `同步节点` pulls existing 3x-ui inbounds into `protocol_node` so the unified list can show nodes that were created outside this panel.
- `重启` restarts Snell by generating an agent task. For Xray-backed nodes it requests a remote Xray restart through 3x-ui.
- `删除` deletes Xray inbounds through 3x-ui. For Snell it generates an agent task that removes the node service and config.

Snell is not a native Xray protocol. This project treats it as the same product-level node type while keeping the runtime adapter separate: Xray nodes go through 3x-ui/Xray, Snell nodes go through the副控 agent and systemd/OpenRC.

### 7. Manage remote port forwards

Open `主控中心` and use `新增转发`.

- The rule belongs to one controlled server.
- The agent installs `socat` when needed and creates a systemd/OpenRC service such as `flux-forward-8.service`.
- A TCP rule uses `TCP-LISTEN:<listenPort>` to forward traffic to `<targetHost>:<targetPort>`.
- A UDP rule uses `UDP-LISTEN:<listenPort>` with the same target shape.
- `编辑`, `重启`, and `删除` all generate agent tasks so every remote change is auditable in `部署任务`.

This is separate from the original Flux Panel Gost forwarding model. The original forwarding pages remain available; `server_forward_rule` is the new multi-server controlled-host forwarding layer.

### 8. View server rules

On a server card, click `规则总览`.

The master collects:

- local `protocol_node` rows
- local `server_forward_rule` rows
- live 3x-ui inbound list when API token is configured
- live 3x-ui outbound config when the panel connection is configured

This is the operator view for checking which inbound, outbound and port-forward rules currently belong to a controlled server.

### 9. Manage inbounds

On a server card:

- `测 3x-ui`: checks the remote panel status through the 3x-ui API.
- `入站`: reads the remote inbound list.
- `入站操作`: add, update or delete an inbound through a structured form. Supported starter modes:
  - VLESS Reality
  - VMess WebSocket
  - Trojan TCP/TLS
  - Shadowsocks
- `高级 JSON`: keeps the original raw payload mode for edge cases. The payload shape is the same as 3x-ui `model.Inbound`; `settings`, `streamSettings` and `sniffing` stay as JSON strings.

For Reality, generate the private/public key pair in 3x-ui or Xray first, then fill `Reality Private Key`, `SNI`, `Dest`, `Short ID`, UUID, email and port before submitting.

### 10. Manage outbounds and traffic

On a server card:

- `配置`: reads the remote full Xray config.
- `出站`: extracts and displays the `outbounds` section.
- `出站流量`: reads remote outbound traffic counters from 3x-ui.
- `同步流量`: pulls remote inbound/client/outbound traffic and writes local rows to `three_xui_traffic_snapshot`.
- `流量快照`: reads recent local traffic snapshots from this panel database.
- `保存出站`: saves the full Xray config back to 3x-ui through login + CSRF. Use this when you have edited outbound JSON.
- `重启 Xray`: requests a remote Xray restart through the 3x-ui API.

Outbound saving intentionally edits the full Xray config rather than only patching one outbound, because 3x-ui stores outbound/routing/DNS as one Xray template. This keeps the connector simple and avoids silently corrupting related routing rules.

Traffic is also synced automatically every 5 minutes for active servers with `3x-ui 面板地址` and `3x-ui API Token` configured.

### 11. Monitor alerts

Open `主控中心` and check `监控告警`.

- Agent heartbeat stale for more than 5 minutes creates an `agent_offline` alert.
- Heartbeats with unhealthy 3x-ui, Xray, Snell or certificate status create service/certificate alerts.
- Certificates expiring within 30 days create warning alerts; expired certificates create critical alerts.
- Deployment task `failed` and timeout results create task alerts.
- Negative or unusually large traffic deltas create traffic anomaly alerts.

Use `确认` only after the remote condition has been checked or fixed. Confirmed alerts stay out of the default open-alert view.

### 12. API endpoints exposed by this project

```text
POST /api/v1/control-server/create
POST /api/v1/control-server/list
POST /api/v1/control-server/update
POST /api/v1/control-server/delete
POST /api/v1/control-server/token
POST /api/v1/control-server/rotate-token
POST /api/v1/control-server/heartbeat
POST /api/v1/deploy-task/create
POST /api/v1/deploy-task/orchestrate
POST /api/v1/deploy-task/list
POST /api/v1/deploy-task/script
POST /api/v1/deploy-task/state
POST /api/v1/deploy-task/delete
POST /api/v1/agent-task/claim
POST /api/v1/agent-task/report
POST /api/v1/monitor-alert/list
POST /api/v1/monitor-alert/ack
POST /api/v1/protocol-node/create
POST /api/v1/protocol-node/update
POST /api/v1/protocol-node/list
POST /api/v1/protocol-node/delete
POST /api/v1/protocol-node/restart
POST /api/v1/protocol-node/sync
POST /api/v1/server-forward/create
POST /api/v1/server-forward/update
POST /api/v1/server-forward/list
POST /api/v1/server-forward/delete
POST /api/v1/server-forward/restart
POST /api/v1/server-rule/overview
POST /api/v1/three-xui/test
POST /api/v1/three-xui/inbounds/list
POST /api/v1/three-xui/inbounds/add
POST /api/v1/three-xui/inbounds/update
POST /api/v1/three-xui/inbounds/delete
POST /api/v1/three-xui/inbounds/set-enable
POST /api/v1/three-xui/clients/add
POST /api/v1/three-xui/clients/update
POST /api/v1/three-xui/clients/delete
POST /api/v1/three-xui/clients/reset-traffic
POST /api/v1/three-xui/config
POST /api/v1/three-xui/outbounds
POST /api/v1/three-xui/outbounds/traffic
POST /api/v1/three-xui/traffic/sync
POST /api/v1/three-xui/traffic/list
POST /api/v1/three-xui/outbounds/save
POST /api/v1/three-xui/restart-xray
```

## Development Notes

Backend:

```bash
cd springboot-backend
mvn package
```

Frontend:

```bash
cd vite-frontend
npm install --legacy-peer-deps
npm run build
```

The frontend now pins `@heroui/theme` and `@heroui/system` to the compatible 2.4.x line and removes the old Vite legacy plugin. If dependency installation is interrupted, delete `vite-frontend/node_modules` and run `npm install --legacy-peer-deps` again before building.

Tailwind v4 loads the HeroUI theme through PostCSS, so `jiti` is pinned in `devDependencies`. This keeps `npm run build` reproducible in local Node and CI environments.

Verified build commands used for this repository:

```bash
docker run --rm -v "$PWD/springboot-backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -DskipTests package
docker run --rm -v "$PWD:/workspace" -v flux_3xui_frontend_node_modules:/workspace/vite-frontend/node_modules -w /workspace/vite-frontend node:22-bookworm bash -lc "npm install --legacy-peer-deps --no-audit --no-fund && npm run build"
```

Reusable smoke checks:

```bash
bash scripts/release-check.sh
bash scripts/release-check.sh --full
bash scripts/test-flux-agent-mock.sh
bash scripts/test-three-xui-fixture.sh
bash scripts/test-compose-smoke.sh --build-local --dry-run
bash scripts/test-compose-smoke.sh --build-local
bash scripts/test-install-matrix.sh
```

`scripts/test-three-xui-fixture.sh` starts a local stateful 3x-ui API fixture and covers Bearer-token success, missing-token and wrong-token paths plus inbound CRUD, client operations, Xray config/outbound/traffic reads and restart routes. `scripts/test-install-matrix.sh` runs non-destructive master/agent/agent-runtime doctor checks inside Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux containers. `scripts/test-compose-smoke.sh --build-local` builds backend/frontend images from the current checkout, starts disposable MySQL/backend/frontend services, checks `GET /flow/test` and the frontend `/`, then removes the smoke containers, volumes and network. It avoids depending on local GHCR pull permissions.

## GitHub Container Images

`.github/workflows/docker-image.yml` builds and pushes two images to GHCR:

```text
ghcr.io/zhizhishu/flux-3xui-orchestrator-backend:latest
ghcr.io/zhizhishu/flux-3xui-orchestrator-frontend:latest
```

Tags are published on `main`, Git tags and manual `workflow_dispatch`. Pull requests build the images without pushing them. The `future` branch also builds backend/frontend images for validation, but it does not push to GHCR; only `main` and `v*` tags publish pullable images. This keeps experimental validation branches from overwriting or polluting release images.

The compose files now point at these GHCR images:

```bash
docker compose -f docker-compose-v4.yml up -d
docker compose -f docker-compose-v6.yml up -d
```

For a fresh server, use the installer instead of preparing the compose files manually:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

The repository is public, so `curl` can fetch the install scripts without a token. GHCR package visibility is controlled separately from repository visibility. If the packages stay private, either log in first for a faster pull:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u zhizhishu --password-stdin
```

or let `scripts/install-master.sh` fall back to local Docker builds from the public source archive.

## Environment

The existing backend expects database and secret values through environment variables, including:

```text
DB_HOST
DB_NAME
DB_USER
DB_PASSWORD
JWT_SECRET
SECRET_ENCRYPTION_KEY
LOG_DIR
```

`SECRET_ENCRYPTION_KEY` should be a stable high-entropy value used for sensitive 3x-ui credentials and API-token encryption; keep it backed up with `.env` and do not rotate it without a migration plan. Current hardening also includes master self-control protection: a `role=master` server can be selected for deliberate self-management, but destructive actions and protected listen ports such as frontend/backend/MySQL/SSH are blocked.

## Next Steps

1. Complete the `future` branch P0 gate: real VPS matrix and a real 3x-ui end-to-end smoke target.
2. Harden day-2 operations: agent upgrade verification, health repair, remote log retention and configurable retries.
3. Add governance features: RBAC, audit log views, agent token expiry/revocation and key-rotation migration.
4. Split legacy upstream wording/mojibake cleanup into a dedicated documentation pass.

## References And Acknowledgements

Flux 3x-ui Orchestrator is an independent project maintained in this repository. It is not an official fork, release or
distribution of the projects below, but it deliberately studies and builds on ideas from them.

Special thanks to these open-source projects:

- [Flux Panel](https://github.com/zhizhishu/flux-panel): the UI style, forwarding-panel foundation, repository structure
  and original operational surface that this project uses as its base.
- [3x-ui](https://github.com/MHSanaei/3x-ui): the Xray/3x-ui protocol-management model and remote panel API behavior
  used as the primary reference for inbound, client, outbound, traffic and Xray restart management.
- [snell.sh](https://github.com/jinqians/snell.sh): the Snell installation flow and deployment-script behavior used as
  the reference for turning Snell into a managed protocol node through the Flux agent.
- [Komari Monitor](https://github.com/komari-monitor/komari): the master/agent monitoring idea used as a reference for
  heartbeat, status collection and multi-server operations.

This repository keeps those inspirations visible so users can understand where the architecture came from, while all
new orchestration code, agent integration, Snell adaptation, 3x-ui proxy APIs, monitor alerts and release workflows live
in this project.

## Safety Notice

This project is intended for legal server administration, traffic forwarding, and proxy-node management on infrastructure you own or are authorized to manage. Do not use it for unauthorized access, abuse, evasion, or activity that violates local laws or service terms.
