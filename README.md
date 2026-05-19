# Flux 3x-ui Orchestrator

Flux 3x-ui Orchestrator is a new control-panel project based on the Flux Panel UI and forwarding-panel foundation. The goal is to evolve it into a master/agent orchestration panel that can manage multiple servers, deploy 3x-ui compatible protocol nodes, and add Snell deployment support.

This repository is an independent project. It uses upstream projects as references and foundations, but future development should happen here.

Project site:

```text
https://zhizhishu.github.io/
```

## Project Direction

- Use `flux-panel` as the UI and forwarding-panel base.
- Add a master-control workspace for managing multiple servers.
- Add agent/secondary-control concepts for server registration, heartbeats, and deployment status.
- Bring in 3x-ui style protocol management for Xray-based nodes.
- Add Snell support through non-interactive deployment scripts and a lightweight agent executor.
- Keep deployment workflows auditable: generate tasks on the master side, then let an authorized agent pull, execute, and report results.

## Current MVP

The first iteration adds the foundation for:

- Control server registry:
  - server CRUD
  - agent token generation and rotation
  - heartbeat endpoint
  - runtime status fields for 3x-ui/Xray/Snell/certificate/CPU/memory/traffic
  - 3x-ui panel connection fields: endpoint, base path, API token, optional login credentials
- Protocol profiles:
  - Snell
  - VLESS / VMess / Trojan / Shadowsocks starter templates
- Deployment tasks:
  - generated task records
  - generated Snell install/restart/status/uninstall script
  - unified `protocol_node` records for Xray/3x-ui inbounds and Snell services
  - one-click 3x-ui orchestration task for installing/configuring 3x-ui, creating starter protocol nodes, installing Snell and returning connection metadata
  - agent task claim/report API protected by `X-Agent-Token`
  - `scripts/flux-agent.sh` polling executor for副控 servers
  - `scripts/install-flux-agent.sh` systemd installer for long-running agents
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
  - protocol profile cards
  - deployment task cards
  - structured 3x-ui inbound form for VLESS Reality, VMess WS, Trojan TLS and Shadowsocks
  - advanced JSON fallback for inbound payloads
  - 3x-ui inbound/outbound operation modals
  - remote traffic sync and local traffic snapshot viewer
  - one-click orchestration modal for 3x-ui, Reality, VMess WS, Trojan TLS, Shadowsocks and Snell
  - service/certificate/traffic status chips on server cards
  - script, token, inbound and config viewers

## Repository Layout

```text
.
├── springboot-backend/     # Spring Boot backend
├── vite-frontend/          # React + Vite + HeroUI frontend
├── scripts/                # Lightweight flux agent executor
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
  ADD COLUMN `xui_api_token` varchar(255) DEFAULT NULL AFTER `xui_base_path`,
  ADD COLUMN `xui_username` varchar(100) DEFAULT NULL AFTER `xui_api_token`,
  ADD COLUMN `xui_password` varchar(255) DEFAULT NULL AFTER `xui_username`,
  ADD COLUMN `xui_two_factor_code` varchar(50) DEFAULT NULL AFTER `xui_password`,
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
- `3x-ui 面板地址`: for example `https://1.2.3.4:54321`.
- `3x-ui Base Path`: only fill this when the remote 3x-ui panel uses a custom web base path, for example `/secret-path`.
- `3x-ui API Token`: required for inbound list/add/update/delete, client operations, Xray config read and Xray restart.
- `3x-ui 用户名` and `3x-ui 密码`: optional, but required when saving full Xray/outbound settings and reading outbound traffic because 3x-ui keeps `/panel/xray/*` behind login session + CSRF.
- `3x-ui TLS 校验`: choose `允许自签名` only when the remote panel uses a self-signed certificate.

### 4. Start a副控 agent

After a server is created, click `Token` on the server card and put the returned token on that server.

For a long-running agent, copy `scripts/flux-agent.sh` and `scripts/install-flux-agent.sh` to the remote server, then run:

```bash
export FLUX_PANEL_URL="https://your-master-panel.example.com"
export FLUX_SERVER_ID="1"
export FLUX_AGENT_TOKEN="paste-agent-token-here"
sudo -E bash ./install-flux-agent.sh ./flux-agent.sh
```

The installer creates `/etc/flux-agent.env`, installs `/usr/local/bin/flux-agent.sh`, enables `flux-agent.service`, and keeps the副控 online through systemd.

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

### 5. One-click 3x-ui orchestration

Open `主控中心`, click `一键编排`, choose one or more servers, then choose:

- whether to install or reuse 3x-ui
- panel port, username, password and web base path
- certificate mode: self-signed, ACME HTTP or none
- protocols to create: VLESS Reality, VMess WebSocket, Trojan TLS and Shadowsocks
- whether to install Snell

Click `生成一键任务`. The master creates one deployment task per selected server. Each remote agent claims its own task automatically, installs/configures 3x-ui, creates the selected protocol nodes, installs Snell when selected, restarts services, then returns 3x-ui endpoint/base path/API token, service status, certificate status and created inbound metadata. The server card updates after the task report or next heartbeat.

The one-click script validates duplicate ports before it is saved. ACME HTTP mode requires the domain DNS to point at the target server and port `80` to be reachable.

### 6. Manage unified protocol nodes

Open `主控中心` and use `新增节点`.

- VLESS / VMess / Trojan / Shadowsocks nodes are created through the remote 3x-ui inbound API and stored locally in `protocol_node`.
- Snell nodes are stored in `protocol_node`, then the master creates an agent task. The remote agent installs or updates a node-specific Snell systemd service such as `snell-node-12.service`, writes `/etc/snell/users/node-12.conf`, starts the service, and reports the final service status plus generated PSK back to the master.
- `同步节点` pulls existing 3x-ui inbounds into `protocol_node` so the unified list can show nodes that were created outside this panel.
- `重启` restarts Snell by generating an agent task. For Xray-backed nodes it requests a remote Xray restart through 3x-ui.
- `删除` deletes Xray inbounds through 3x-ui. For Snell it generates an agent task that removes the node service and config.

Snell is not a native Xray protocol. This project treats it as the same product-level node type while keeping the runtime adapter separate: Xray nodes go through 3x-ui/Xray, Snell nodes go through the副控 agent and systemd.

### 7. Manage inbounds

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

### 8. Manage outbounds and traffic

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

### 9. API endpoints exposed by this project

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
POST /api/v1/protocol-node/create
POST /api/v1/protocol-node/update
POST /api/v1/protocol-node/list
POST /api/v1/protocol-node/delete
POST /api/v1/protocol-node/restart
POST /api/v1/protocol-node/sync
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
docker run --rm -v "$PWD:/workspace" -v flux_3xui_frontend_node_modules:/workspace/vite-frontend/node_modules -w /workspace/vite-frontend node:20-bookworm bash -lc "npm install --legacy-peer-deps --no-audit --no-fund && npm run build"
```

## Environment

The existing backend expects database and secret values through environment variables, including:

```text
DB_HOST
DB_NAME
DB_USER
DB_PASSWORD
JWT_SECRET
LOG_DIR
```

## Next Steps

1. Add runtime smoke tests against disposable 3x-ui containers once stable fixtures are available.
2. Add more protocol-specific guardrails, such as Reality public-key display and outbound tag validation.
3. Add server-side checksums for Snell binary downloads.
4. Add task retry/backoff policy controls in the UI.

## Upstream References

- Flux Panel: `https://github.com/zhizhishu/flux-panel`
- 3x-ui: `https://github.com/MHSanaei/3x-ui`
- Snell script reference: `https://github.com/jinqians/snell.sh`
- Komari monitor reference: `https://github.com/komari-monitor/komari`

## Safety Notice

This project is intended for legal server administration, traffic forwarding, and proxy-node management on infrastructure you own or are authorized to manage. Do not use it for unauthorized access, abuse, evasion, or activity that violates local laws or service terms.
