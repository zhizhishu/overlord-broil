# Operations Guide

This guide describes how to install, verify and operate Overlord Broil as a single master product with controlled agents.

## Runtime Shape

Default deployment:

```text
browser / controlled agent -> overlord-master:5166 -> MySQL network service
```

Optional lightweight deployment:

```text
browser / controlled agent -> overlord-master:5166 -> SQLite files in /opt/overlord-broil/data
```

The master is the only public control entry by default. Backend debug, MySQL and phpMyAdmin are not exposed unless explicitly enabled.

## Ports

| Port | Owner | Default exposure |
| --- | --- | --- |
| `5166/tcp` | Master Web UI, API and agent callback | Public |
| `6365/tcp` | Backend debug alias | Off, only with `OB_EXPOSE_BACKEND=1` |
| `3306/tcp` | MySQL | Docker network only |
| `5168/tcp` | Optional controlled-host node-core UI/API | Only when you choose to expose it |
| `80/tcp` | ACME HTTP validation | Only when selected |
| custom | Xray, Snell and remote-forward business ports | Operator-defined |

Controlled agents do not need an inbound management port. They poll the master URL that users open in the browser.

## Install Master

Default MySQL mode:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh | sudo bash
```

SQLite mode:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh \
  | sudo env OB_DB_MODE="sqlite" OB_FRONTEND_PORT="5166" bash
```

Minimal systems without Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master-bootstrap.sh | sudo sh
```

Preflight:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

Day-2 commands:

```bash
sudo bash /opt/overlord-broil/install-master.sh upgrade
sudo bash /opt/overlord-broil/install-master.sh backup
sudo bash /opt/overlord-broil/install-master.sh restore --backup-file /opt/overlord-broil/backups/overlord-master-backup-YYYYMMDD-HHMMSS.tar.gz
sudo bash /opt/overlord-broil/install-master.sh uninstall --yes
```

## Install Controlled Agent

Create a server in the control center, click `Join Command` on the server card, then run the generated one-line command. The command uses a short-lived join token; the agent registers itself and stores the internal server id/token locally.

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent.sh \
  | sudo env OB_MASTER_URL="http://MASTER_IP:5166" OB_JOIN_TOKEN="paste-join-token-here" bash
```

Alpine or minimal systems:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent-bootstrap.sh \
  | sudo env OB_MASTER_URL="http://MASTER_IP:5166" OB_JOIN_TOKEN="paste-join-token-here" sh
```

Preflight:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent.sh \
  | sudo env OB_MASTER_URL="http://MASTER_IP:5166" OB_JOIN_TOKEN="paste-join-token-here" bash -s -- doctor
```

## Product Modules

| Module | Runtime boundary | Executor |
| --- | --- | --- |
| Inbound nodes | VLESS Reality, VMess, Trojan, Shadowsocks and Snell | master API + agent task |
| Outbound and routing | outbounds, routing, IPv4/IPv6 strategy and traffic | master API + agent task |
| Forwarding and tunnels | TCP/UDP remote forwarding | agent task |
| Certificates | self-signed certificates, ACME and expiry state | agent task |
| Settings logs | task, agent and operation lifecycle | master API + agent task |

Server-card actions, task results and backend validation use the same normalized status model.

Dangerous actions, including agent uninstall and runtime-port closure, require explicit confirmation in the UI and a matching backend confirmation payload.

## Operator Flow

1. Open `http://MASTER_IP:5166`.
2. Register each controlled server.
3. Install the controlled agent with the generated join command.
4. Wait for heartbeat.
5. Select one or more servers.
6. Run deployments for node core, starter nodes, Snell, certificates, firewall checks or remote forwarding.
7. Use server cards, task cards and operation logs to verify status.

Snell is unified as a product-layer protocol node, but it remains an independent service on the controlled host.

## Low-Memory Hosts

| Memory | Policy |
| --- | --- |
| `< 200 MB` | Nano critical. Block full node-core deployment and Xray node creation; prefer Snell or remote forwarding. |
| `< 256 MB` | Nano. Show strong warnings; keep workloads tiny. |
| `< 512 MB` | Small. Xray can work only with careful swap and low concurrency. |

Alpine/OpenRC can run the agent, Snell and forwarding tasks. Full node-core install/configure deployment is intended for systemd hosts.

## Verification

Local release smoke:

```bash
bash -n scripts/*.sh
sh -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh
bash scripts/test-agent-mock.sh
bash scripts/test-xray-runtime-fixture.sh
bash scripts/test-sqlite-schema.sh
bash scripts/test-master-port-contract.sh
```

Frontend build:

```bash
cd vite-frontend
npm install --legacy-peer-deps
npm run build
```

Backend build with Docker:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v overlord-broil-m2:/root/.m2 \
  -w /workspace/springboot-backend \
  maven:3.9.9-eclipse-temurin-21 \
  mvn -B -DskipTests package
```

Optional real node-core contract:

```bash
export XRAY_RUNTIME_E2E_URL="https://node-core.example.com:5168"
export XRAY_RUNTIME_E2E_TOKEN="YOUR_XRAY_RUNTIME_API_TOKEN"
bash scripts/test-xray-runtime-e2e.sh
```

Optional write-mode contract, using an unused high port:

```bash
XRAY_RUNTIME_E2E_WRITE=1 XRAY_RUNTIME_E2E_PORT=42123 bash scripts/test-xray-runtime-e2e.sh
```

Optional live Snell smoke on an authorized host:

```bash
OB_MASTER_URL="http://127.0.0.1:5166" OB_SNELL_PORT=18390 bash scripts/test-snell-real-smoke.sh
```

## Backup And Recovery

MySQL mode uses Docker volumes. SQLite mode stores data under `/opt/overlord-broil/data` unless `SQLITE_DATA_DIR` is changed.

Use `install-master.sh backup` before upgrades. SQLite backups stop the master briefly so copied database files remain consistent.

## Security Notes

- Keep `.env`, `SECRET_ENCRYPTION_KEY`, agent tokens, node-core API tokens, passwords, 2FA codes, Snell PSK values and private keys out of logs and issues.
- Cloud firewall/security groups are outside local firewall automation and must be checked separately.
- Use only infrastructure you own or are authorized to administer.
