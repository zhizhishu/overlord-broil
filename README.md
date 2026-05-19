# Flux 3x-ui Orchestrator

Flux 3x-ui Orchestrator is a new control-panel project based on the Flux Panel UI and forwarding-panel foundation. The goal is to evolve it into a master/agent orchestration panel that can manage multiple servers, deploy 3x-ui compatible protocol nodes, and add Snell deployment support.

This repository is an independent project. It uses upstream projects as references and foundations, but future development should happen here.

Project site:

```text
https://zhizhishu.github.io/flux-3xui-orchestrator/
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
- Protocol profiles:
  - Snell
  - VLESS / VMess / Trojan / Shadowsocks starter templates
- Deployment tasks:
  - generated task records
  - generated Snell install/restart/status/uninstall script
  - placeholder Xray/3x-ui payload generation for the next agent integration step
- Frontend workspace:
  - new `主控中心` page
  - server cards
  - protocol profile cards
  - deployment task cards
  - script and token viewer

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
- Backend services:
  - `springboot-backend/src/main/java/com/admin/service/impl/ControlServerServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/ProtocolProfileServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/DeployTaskServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/SnellTemplateServiceImpl.java`
- Frontend page:
  - `vite-frontend/src/pages/orchestrator.tsx`

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

1. Add a real agent executor that can pull or receive deployment tasks.
2. Add a 3x-ui compatible remote inbound HTTP client.
3. Add traffic snapshot sync from remote nodes.
4. Add safer Snell version/checksum resolution on the master side.
5. Run full backend and frontend builds in an environment with Java/Maven and complete npm dependencies.

## Upstream References

- Flux Panel: `https://github.com/zhizhishu/flux-panel`
- 3x-ui: `https://github.com/MHSanaei/3x-ui`
- Snell script reference: `https://github.com/jinqians/snell.sh`
- Komari monitor reference: `https://github.com/komari-monitor/komari`

## Safety Notice

This project is intended for legal server administration, traffic forwarding, and proxy-node management on infrastructure you own or are authorized to manage. Do not use it for unauthorized access, abuse, evasion, or activity that violates local laws or service terms.
