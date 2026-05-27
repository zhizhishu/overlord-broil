# Overlord Broil

[中文说明](README.zh-CN.md)

Overlord Broil is an independent master/agent operations console for dense multi-server node deployment. It unifies Xray/Reality, Snell, remote port forwarding, certificates, firewall checks, traffic sync and agent maintenance behind one control-plane workflow.

Current release: `0.6.0`, a public-trial / release-candidate build. It is suitable for self-hosted testing and small authorized deployments, but it is not a broad `1.0` long-running stability promise yet.

Project site:

```text
https://zhizhishu.github.io/overlord-broil/
https://zhizhishu.github.io/
```

## Architecture

The supported runtime is a single `overlord-master` image:

```text
Browser / controlled agent
        |
        v
overlord-master :5166
  - embedded Web UI
  - API
  - task engine
  - node orchestration
  - status sync
        |
        v
MySQL on the Docker network
or optional SQLite in /app/data
```

The master exposes one product surface with eight modules:

| Module | Scope |
| --- | --- |
| Dashboard | online state, traffic, node count, alerts and certificate state |
| Servers | one-command controlled-agent join, heartbeat, CPU, memory and service status |
| Inbound nodes | VLESS Reality, VMess, Trojan, Shadowsocks and Snell |
| Outbound and routing | outbounds, routing rules, IPv4/IPv6 strategy and rule order |
| Forwarding and tunnels | remote TCP/UDP forwarding, tunnel rules and rate limits |
| Traffic | user, node, inbound and outbound traffic snapshots |
| Certificates | self-signed, ACME, expiry state and renewal tasks |
| Settings | users, security, backup, update and operation logs |

Snell is unified in the inbound-node product flow, but it is not a native Xray core protocol. The controlled agent deploys Snell as an independent service on the target host and reports it through the same node/status model.

## UI Preview

![Overlord Broil live control center](docs/assets/actual-control-center-top.png)

![Overlord Broil login](docs/assets/actual-login.png)

The UI is a dense operations console: server cards, grouped actions, compact status chips and a unified rule view. It is built for repeated infrastructure work, not for a marketing landing page.

Current UI coverage includes:

- server registry, tokens, heartbeats and status cards
- Xray inbound, outbound, routing, config, traffic and restart actions
- Snell node create/restart/remove flows
- remote TCP/UDP forward rules
- server health, service and certificate state
- compact operation logs for task and agent events
- operation audit timeline for task creation, rejection, manual state changes, retry/delete, agent claim and agent report events
- agent diagnostics, logs, restart, upgrade, uninstall and repair tasks
- monitor alerts and a unified rule center
- `zh-CN` / `en-US` language switching

## Default Ports

The master exposes one public entry by default:

| Port | Purpose | Published by default |
| --- | --- | --- |
| `5166/tcp` | Master Web UI, API and controlled-agent callback | yes |
| `6365/tcp` | backend debug alias | no, only with `OB_EXPOSE_BACKEND=1` |
| `3306/tcp` | MySQL | no, Docker network only |
| SQLite | Optional local master DB file | no network port |
| phpMyAdmin | temporary maintenance | no, only with `OB_PHPMYADMIN_PORT` |

During install or upgrade, the script removes old split-stack containers and optional phpMyAdmin helpers so previous `80/6365/8066` exposures do not survive the move to the single `overlord-master` entry. In SQLite mode it also stops the obsolete `gost-mysql` container while keeping its Docker volumes and old install files untouched for manual recovery.

Controlled agents do not need an inbound management port. They call the same master URL users open in the browser:

```text
http://MASTER_IP:5166
```

Controlled hosts expose only the business ports you choose: optional node-core port `5168`, Xray/Reality inbound ports, Snell listen ports, remote-forward listen ports and ACME HTTP `80/tcp` when selected.

## Quick Start

Install the master:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh | sudo bash
```

Alpine or minimal images without `bash`:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master-bootstrap.sh | sudo sh
```

SQLite mode:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh \
  | sudo env OB_DB_MODE="sqlite" OB_FRONTEND_PORT="5166" bash
```

Run a non-destructive preflight before installing on a live host:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

Day-2 operations:

```bash
sudo bash /opt/overlord-broil/install-master.sh upgrade
sudo bash /opt/overlord-broil/install-master.sh backup
sudo bash /opt/overlord-broil/install-master.sh restore --backup-file /opt/overlord-broil/backups/overlord-master-backup-YYYYMMDD-HHMMSS.tar.gz
sudo bash /opt/overlord-broil/install-master.sh uninstall --yes
```

## Controlled Agent Install

Create a server in the master control center, then use the server card `Join Command` action. The master generates a one-line install command with `OB_MASTER_URL` and a short-lived `OB_JOIN_TOKEN`; the controlled host exchanges it for its internal server id and agent token automatically.

Install the controlled agent on that host:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent.sh \
  | sudo env OB_MASTER_URL="http://MASTER_IP:5166" OB_JOIN_TOKEN="paste-join-token-here" bash
```

Alpine or minimal images:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent-bootstrap.sh \
  | sudo env OB_MASTER_URL="http://MASTER_IP:5166" OB_JOIN_TOKEN="paste-join-token-here" sh
```

Preflight:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent.sh \
  | sudo env OB_MASTER_URL="http://MASTER_IP:5166" OB_JOIN_TOKEN="paste-join-token-here" bash -s -- doctor
```

The agent runs through systemd or OpenRC, claims tasks from the master, executes them locally and reports results back.

## Operator Flow

1. Install the master and open `http://MASTER_IP:5166`.
2. Log in and open the master control center.
3. Register each controlled server.
4. Install the agent with the generated join command.
5. Wait for heartbeat.
6. Select one or more servers and create deployment plans:
   - install or reuse the node core
   - create VLESS Reality, VMess WebSocket, Trojan TLS or Shadowsocks nodes
   - deploy Snell nodes
   - issue or bind certificates
   - sync rules and traffic
7. Use server cards for inbound/outbound, Snell, forwarding, certificate, firewall and agent maintenance work.

## Low-Memory Hosts

Agent heartbeat reports total memory. The master classifies tiny hosts:

| Profile | Memory | Policy |
| --- | --- | --- |
| `nano-critical` | `< 200 MB` | blocks full Xray deployment; use Snell or forwarding |
| `nano` | `< 256 MB` | shows warning; avoid heavy runtimes |
| `small` | `< 512 MB` | consider swap before complex nodes |
| `standard` | `>= 512 MB` | normal path |

## Linux Support

| Target | Debian / Ubuntu | Rocky / Oracle Linux | Alpine / OpenRC |
| --- | --- | --- | --- |
| Master Docker stack | supported | supported | supported with bootstrap |
| Agent service | systemd | systemd | OpenRC |
| Snell node tasks | systemd | systemd | OpenRC |
| Remote forwarding tasks | systemd + `socat` | systemd + `socat` | OpenRC + `socat` |
| Full node-core install/configure | supported | supported | not supported in `0.6.0` |

## Docker And GHCR

Default master image:

```text
ghcr.io/zhizhishu/overlord-broil:latest
```

Supported deployments use the single `overlord-master` image. Backend and frontend source modules remain in the repository, but deployment and releases are bundled into the master image.

`main` and `v*` tags publish GHCR images. The `future` branch builds images for validation, but does not overwrite release images.

## API Summary

Product system APIs:

```text
POST /api/v1/runtime-provider/list
POST /api/v1/runtime-provider/resolve
```

Core task flow:

```text
POST /api/v1/control-server/create
POST /api/v1/control-server/list
POST /api/v1/control-server/token
POST /api/v1/control-server/install-command
POST /api/v1/control-server/heartbeat
POST /api/v1/deploy-task/create
POST /api/v1/deploy-task/plans
POST /api/v1/deploy-task/list
POST /api/v1/deploy-task/retry
POST /api/v1/agent-task/claim
POST /api/v1/agent-task/report
```

Profiles, nodes, forwarding and node-core routes:

```text
POST /api/v1/protocol-profile/create
POST /api/v1/protocol-profile/list
POST /api/v1/protocol-profile/update
POST /api/v1/protocol-profile/delete
POST /api/v1/protocol-profile/ensure-defaults
POST /api/v1/protocol-node/create
POST /api/v1/protocol-node/list
POST /api/v1/protocol-node/sync
POST /api/v1/server-forward/create
POST /api/v1/server-forward/list
POST /api/v1/server-rule/overview
POST /api/v1/runtimes/xray/inbounds/list
POST /api/v1/runtimes/xray/outbounds
POST /api/v1/runtimes/xray/traffic/sync
POST /api/v1/runtimes/xray/restart-xray
```

## Verification

Full release gate:

```bash
bash scripts/release-check.sh --full
```

Backend with Docker Maven:

```bash
docker run --rm -v "$PWD:/workspace" -v overlord-broil-m2:/root/.m2 -w /workspace/springboot-backend maven:3.9.9-eclipse-temurin-21 mvn -B "-Dtest=RuntimeProviderServiceTest,DeployTaskServiceImplTest,XrayRuntimeRouteContractTest" test
```

Frontend:

```bash
cd vite-frontend
npm install --legacy-peer-deps
npm run build
```

Common smoke checks:

```bash
bash scripts/test-agent-mock.sh
bash scripts/test-xray-runtime-fixture.sh
bash scripts/test-snell-real-smoke.sh
bash scripts/test-xray-runtime-e2e.sh
bash scripts/test-compose-smoke.sh --build-local --dry-run
```

Real node-core contract smoke is optional and skips unless a target endpoint and API token are provided:

```bash
export XRAY_RUNTIME_E2E_URL="https://node-core.example.com:5168"
export XRAY_RUNTIME_E2E_TOKEN="YOUR_XRAY_RUNTIME_API_TOKEN"
bash scripts/test-xray-runtime-e2e.sh
```

To create, toggle and delete a temporary VLESS inbound on the real node-core host, opt in explicitly:

```bash
XRAY_RUNTIME_E2E_WRITE=1 XRAY_RUNTIME_E2E_PORT=42123 bash scripts/test-xray-runtime-e2e.sh
```

Live validation note: on `isrco-hk`, an authorized disposable node-core container passed the direct E2E write contract and the Overlord master API inbound add/toggle/delete path. The temporary ports `42123` and `42124` were cleaned after the run.

Real Snell smoke runs against a live master/agent host. It logs in to the master, creates a temporary Snell protocol node, lets the controlled agent claim the task, checks the service and listen port, then deletes the temporary node by default:

```bash
OB_MASTER_URL="http://127.0.0.1:5166" OB_SNELL_PORT=18390 bash scripts/test-snell-real-smoke.sh
```

## Remaining Work Before 1.0

- Real VPS matrix: Debian, Ubuntu, Rocky Linux, Oracle Linux and Alpine.
- Extend the recorded real node-core E2E beyond the current `isrco-hk` container run to more VPS/provider targets.
- Better certificate, firewall and cloud-security-group diagnostics.
- RBAC, audit retention/export, agent token expiry/revocation and key-rotation migration.
- Mobile layout, loading/error states and task-detail polish.

## Safety Notice

Use this project only on infrastructure you own or are authorized to administer. Do not use it for unauthorized access, abuse, evasion, illegal activity or violations of service terms.
