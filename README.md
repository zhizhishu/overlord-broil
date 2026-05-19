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
- Add Snell support through non-interactive deployment scripts.
- Keep deployment workflows auditable: generate tasks and scripts first, execute through agents later.

## Current MVP

The first iteration adds the foundation for:

- Control server registry:
  - server CRUD
  - agent token generation and rotation
  - heartbeat endpoint
  - runtime status fields for Xray/Snell/CPU/memory
  - 3x-ui panel connection fields: endpoint, base path, API token, optional login credentials
- Protocol profiles:
  - Snell
  - VLESS / VMess / Trojan / Shadowsocks starter templates
- Deployment tasks:
  - generated task records
  - generated Snell install/restart/status/uninstall script
- 3x-ui remote panel management:
  - test remote 3x-ui connection
  - list inbounds through `/panel/api/inbounds/list`
  - add / update / delete inbounds through the real 3x-ui API
  - add / update / delete inbound clients and reset client traffic through backend API endpoints
  - read full Xray config and extract outbounds
  - save full Xray / outbound config through 3x-ui login + CSRF when credentials are configured
  - restart remote Xray through `/panel/api/server/restartXrayService`
- Frontend workspace:
  - new `主控中心` page
  - server cards
  - protocol profile cards
  - deployment task cards
  - 3x-ui inbound/outbound operation modals
  - script, token, inbound and config viewers

## Repository Layout

```text
.
├── springboot-backend/     # Spring Boot backend
├── vite-frontend/          # React + Vite + HeroUI frontend
├── go-gost/                # Existing forwarding/node component from Flux Panel
├── vitepress/              # Existing documentation site
├── gost.sql                # Database schema seed
└── TASK_LOG.md             # Local handoff/task log for ongoing development
```

Local-only reference repositories are kept in `_references/` and ignored by Git.

## Important Paths

- Backend controllers:
  - `springboot-backend/src/main/java/com/admin/controller/ControlServerController.java`
  - `springboot-backend/src/main/java/com/admin/controller/ProtocolProfileController.java`
  - `springboot-backend/src/main/java/com/admin/controller/DeployTaskController.java`
  - `springboot-backend/src/main/java/com/admin/controller/ThreeXuiController.java`
- Backend services:
  - `springboot-backend/src/main/java/com/admin/service/impl/ControlServerServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/ProtocolProfileServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/DeployTaskServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/SnellTemplateServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/ThreeXuiServiceImpl.java`
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
  ADD COLUMN `xui_last_sync` bigint(20) DEFAULT NULL AFTER `xui_allow_insecure`;
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
- `3x-ui 用户名` and `3x-ui 密码`: optional, but required when saving full Xray/outbound settings because 3x-ui keeps `/panel/xray/update` behind login session + CSRF.
- `3x-ui TLS 校验`: choose `允许自签名` only when the remote panel uses a self-signed certificate.

### 4. Manage inbounds

On a server card:

- `测 3x-ui`: checks the remote panel status through the 3x-ui API.
- `入站`: reads the remote inbound list.
- `入站操作`: add, update or delete an inbound. The payload is the same shape as 3x-ui `model.Inbound`; `settings`, `streamSettings` and `sniffing` stay as JSON strings.

The default payload is a VLESS Reality starter. Replace UUID, private key, port, SNI, email and other values before submitting.

### 5. Manage outbounds

On a server card:

- `配置`: reads the remote full Xray config.
- `出站`: extracts and displays the `outbounds` section.
- `保存出站`: saves the full Xray config back to 3x-ui through login + CSRF. Use this when you have edited outbound JSON.
- `重启 Xray`: requests a remote Xray restart through the 3x-ui API.

Outbound saving intentionally edits the full Xray config rather than only patching one outbound, because 3x-ui stores outbound/routing/DNS as one Xray template. This keeps the connector simple and avoids silently corrupting related routing rules.

### 6. API endpoints exposed by this project

```text
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

The frontend dependency tree currently has HeroUI peer-version conflicts, so `--legacy-peer-deps` is required unless dependencies are later normalized.

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

1. Add a real agent executor that can pull or receive Snell deployment tasks.
2. Add inbound traffic snapshot sync into local tables instead of only viewing remote JSON.
3. Add structured forms for common VLESS / VMess / Trojan / Shadowsocks inbound creation so users do not need to paste JSON.
4. Add safer Snell version/checksum resolution on the master side.
5. Run full backend and frontend builds in an environment with Java/Maven and a normalized HeroUI dependency tree.

## Upstream References

- Flux Panel: `https://github.com/zhizhishu/flux-panel`
- 3x-ui: `https://github.com/MHSanaei/3x-ui`
- Snell script reference: `https://github.com/jinqians/snell.sh`
- Komari monitor reference: `https://github.com/komari-monitor/komari`

## Safety Notice

This project is intended for legal server administration, traffic forwarding, and proxy-node management on infrastructure you own or are authorized to manage. Do not use it for unauthorized access, abuse, evasion, or activity that violates local laws or service terms.
