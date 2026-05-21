# Operations

This checklist is for running the public Flux 3x-ui Orchestrator repo as a small master/agent deployment.

## Install Paths

| Component | Path |
| --- | --- |
| Master install root | `/opt/flux-3xui-orchestrator` |
| Master environment | `/opt/flux-3xui-orchestrator/.env` |
| Master compose files | `/opt/flux-3xui-orchestrator/docker-compose-v4.yml` or `docker-compose-v6.yml` |
| Database seed | `/opt/flux-3xui-orchestrator/gost.sql` |
| Master backups | `/opt/flux-3xui-orchestrator/backups` |
| Backend logs volume | Docker volume `backend_logs`, mounted at `/app/logs` |
| MySQL data volume | Docker volume `mysql_data` |
| Agent environment | `/etc/flux-agent.env` |
| Agent binary script | `/usr/local/bin/flux-agent.sh` |
| Agent systemd unit | `flux-agent.service` |
| Agent OpenRC service | `/etc/init.d/flux-agent` |
| Agent work directory | `/var/lib/flux-agent` |
| Snell node configs | `/etc/snell/users/node-<id>.conf` |
| Snell services | `snell-node-<id>.service` on systemd, `/etc/init.d/snell-node-<id>` on OpenRC |
| Forwarding services | `flux-forward-<id>.service` on systemd, `/etc/init.d/flux-forward-<id>` on OpenRC |

## Linux Support Matrix

| Target | Debian / Ubuntu | Rocky / Oracle Linux | Alpine / OpenRC |
| --- | --- | --- | --- |
| Master Docker stack | Supported | Supported | Supported with the bootstrap installer when `bash` is missing |
| Agent service | systemd | systemd | OpenRC |
| Snell node tasks | systemd | systemd | OpenRC |
| Remote forwarding tasks | systemd + `socat` | systemd + `socat` | OpenRC + `socat` |
| Full 3x-ui install/configure | Supported | Supported | Not supported in `0.6.0`; use a systemd host |

The master installer and agent installer are bash scripts. On minimal systems, use the `*-bootstrap.sh` installers; they run under `/bin/sh`, install `bash` plus base dependencies, then hand off to the normal installer.

## Master Install And Upgrade

Install the master with the default IPv4 compose stack:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

Bootstrap form for Alpine or minimal images without `bash`:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master-bootstrap.sh | sudo sh
```

Common overrides:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_FRONTEND_PORT="8080" FLUX_BACKEND_PORT="6365" FLUX_PHPMYADMIN_PORT="18066" FLUX_NETWORK_STACK="v4" bash
```

Day-2 actions:

```bash
sudo bash /opt/flux-3xui-orchestrator/install-master.sh upgrade
sudo bash /opt/flux-3xui-orchestrator/install-master.sh backup
sudo bash /opt/flux-3xui-orchestrator/install-master.sh restore --backup-file /opt/flux-3xui-orchestrator/backups/flux-master-backup-YYYYMMDD-HHMMSS.tar.gz
sudo bash /opt/flux-3xui-orchestrator/install-master.sh uninstall --yes
```

If the installer script is not present locally, use the same raw GitHub command with `bash -s -- <action>`.

## Doctor Preflight

Run the master doctor before installing on a new host or changing ports:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

It checks OS/package-manager detection, root status, Docker/Compose, Docker daemon reachability, existing `.env` values and whether frontend/backend/phpMyAdmin ports are already occupied. For CI/container checks where Docker is intentionally unavailable:

```bash
FLUX_DOCTOR_REQUIRE_DOCKER=0 \
FLUX_FRONTEND_PORT=18080 \
FLUX_BACKEND_PORT=16365 \
FLUX_PHPMYADMIN_PORT=18066 \
  bash scripts/install-master.sh doctor
```

Run the agent installer doctor before installing a controlled host:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="https://your-master-panel.example.com" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash -s -- doctor
```

After an agent is installed, run the local runtime doctor:

```bash
sudo -E /usr/local/bin/flux-agent.sh --doctor
```

The runtime doctor checks the panel URL, server id, token presence, writable work directory, Python/Bash/Curl dependencies, procfs counters and service-manager availability.

## Docker And GHCR Notes

The compose files use:

```text
ghcr.io/zhizhishu/flux-3xui-orchestrator-backend:latest
ghcr.io/zhizhishu/flux-3xui-orchestrator-frontend:latest
```

Public repository access does not always mean public GHCR package access. If pulls fail, either log in:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u zhizhishu --password-stdin
```

or let the installer fall back to building images from the public source archive.

Validate compose before changing a live host:

```bash
docker compose -f docker-compose-v4.yml config
docker compose -f docker-compose-v6.yml config
```

## Agent Operations

Install an agent on each controlled server:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="https://your-master-panel.example.com" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash
```

Bootstrap form for Alpine or minimal images:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent-bootstrap.sh \
  | sudo env FLUX_PANEL_URL="https://your-master-panel.example.com" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" sh
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

Tune reliability in `/etc/flux-agent.env`:

```bash
FLUX_HTTP_RETRIES=4
FLUX_HTTP_BACKOFF_BASE=2
FLUX_HTTP_BACKOFF_MAX=30
FLUX_HTTP_CONNECT_TIMEOUT=10
FLUX_HTTP_MAX_TIME=60
FLUX_TASK_TIMEOUT_SECONDS=7200
FLUX_TASK_TIMEOUT_KILL_SECONDS=30
```

Remote maintenance from the master panel:

| Server-card action | What it does |
| --- | --- |
| `Agent / 诊断` | Creates an `agent-maintenance` task that runs `/usr/local/bin/flux-agent.sh --doctor` on the controlled host. |
| `Agent / 日志` | Collects recent systemd/OpenRC logs plus recent `/var/lib/flux-agent/task-*.out|err` task logs. |
| `Agent / 重启` | Runs the doctor, then schedules a delayed `flux-agent` service restart so the report can return before restart. |
| `Agent / 升级` | Downloads the latest `scripts/flux-agent.sh`, runs `bash -n`, installs it and schedules a service restart. |

## Operational Checklist

- Confirm `.env` has non-default `DB_PASSWORD`, `JWT_SECRET` and `SECRET_ENCRYPTION_KEY`.
- Back up `SECRET_ENCRYPTION_KEY` with `.env`; encrypted 3x-ui credentials and API tokens cannot be restored safely if the key is lost or rotated without planning.
- Keep controlled-server agents off the master host unless you are deliberately testing self-control behavior. A `role=master` server can self-manage safe tasks, while destructive actions and protected listen ports such as frontend/backend/MySQL/SSH are blocked.
- Confirm the frontend and backend ports are reachable only from the intended networks.
- Confirm `docker compose ps` shows healthy `mysql`, `backend` and `frontend` services.
- Check `GET /flow/test` through the backend port after every upgrade.
- Create a backup before upgrades and before schema-affecting changes.
- Store 3x-ui API tokens only in the panel fields intended for that purpose; do not paste tokens into issue reports or logs.
- For each controlled server, rotate the agent token after handoff or suspected exposure.
- Verify agent heartbeats before sending orchestration, Snell or forwarding tasks.
- Send full 3x-ui install/configure orchestration only to normal systemd hosts. Alpine/OpenRC controlled hosts can run agent, Snell and forwarding tasks, but the upstream 3x-ui installation path is blocked by preflight.
- For ACME HTTP certificate mode, verify DNS points at the target server and port `80` is reachable before task creation.
- Verify duplicate protocol and forwarding ports before deploying to a shared host.
- Review task stdout/stderr before retrying failed deployment tasks.
- Review `监控告警` after every orchestration batch; acknowledge only after the remote service, certificate, task or traffic condition has been checked.
- Keep GHCR package visibility and tag policy aligned with the public README commands.

## Production Release Gate

Run the full release gate before publishing a Git tag, GitHub Release or live-host install announcement:

```bash
bash scripts/release-check.sh --full
```

Release readiness means:

- `VERSION`, `README.md`, release notes and the public docs site name the same release.
- CI is green on `main`.
- Docker Images workflow is green on `main` and GHCR has fresh backend/frontend images.
- `scripts/install-master.sh` succeeds on a clean Linux host or falls back to local source builds when GHCR pulls are unavailable.
- `scripts/install-master-bootstrap.sh` and `scripts/install-flux-agent-bootstrap.sh` are syntax-checked so minimal Alpine-style hosts can install base dependencies before handing off to bash installers.
- `scripts/test-install-matrix.sh` passes on Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux container images.
- `.env` and backup handling are understood before the first live install.
- Public firewall rules intentionally expose only the frontend/API ports needed for your environment.
- The release notes clearly state whether the release was verified through Docker/CI only or through real VPS hosts.

Default master ports:

| Port | Component | Production note |
| --- | --- | --- |
| `80` | Frontend panel | Change with `FLUX_FRONTEND_PORT` when another web server already owns port 80. |
| `6365` | Backend API and agent callback | Change with `FLUX_BACKEND_PORT`; agents must use the same URL. |
| `8066` | phpMyAdmin | Change with `FLUX_PHPMYADMIN_PORT`; restrict by firewall, remove the published port, or use only during maintenance. |
| `3306` | MySQL | Container-internal in the shipped compose files. |

Controlled hosts do not need an inbound agent port. They only expose the 3x-ui panel port, Xray/Snell node ports, remote-forward listen ports, and ACME HTTP `80` when selected by your orchestration plan.

## Local And CI Verification

Use these before publishing a release candidate:

```bash
docker run --rm -v "$PWD/springboot-backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -DskipTests package
docker run --rm -v "$PWD:/workspace" -v flux_3xui_frontend_node_modules:/workspace/vite-frontend/node_modules -w /workspace/vite-frontend node:22-bookworm bash -lc "npm install --legacy-peer-deps --no-audit --no-fund && npm run build"
bash scripts/release-check.sh
bash scripts/release-check.sh --full
bash scripts/test-flux-agent-mock.sh
bash scripts/test-three-xui-fixture.sh
bash scripts/test-install-matrix.sh
bash scripts/test-compose-smoke.sh --build-local --dry-run
bash scripts/test-compose-smoke.sh --build-local
```

The 3x-ui fixture test uses a short-lived local Python HTTP server, checks Bearer-token success/missing/wrong-token paths plus inbound/outbound/config/traffic/restart routes, and exits without leaving ports open. The install matrix runs non-destructive doctor checks in Docker containers; it is useful coverage for shell portability and package-manager detection, but it is not a substitute for a real VPS matrix with systemd/OpenRC, cloud firewall and public DNS. The full compose smoke test should remove its disposable containers, network and volumes when it exits. If it is interrupted, inspect Docker resources manually before rerunning.
