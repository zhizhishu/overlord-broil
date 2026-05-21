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
| Agent work directory | `/var/lib/flux-agent` |
| Snell node configs | `/etc/snell/users/node-<id>.conf` |
| Snell services | `snell-node-<id>.service` |
| Forwarding services | `flux-forward-<id>.service` |

## Master Install And Upgrade

Install the master with the default IPv6 auto-detection:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

Common overrides:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_FRONTEND_PORT="8080" FLUX_BACKEND_PORT="6365" FLUX_NETWORK_STACK="v4" bash
```

Day-2 actions:

```bash
sudo bash /opt/flux-3xui-orchestrator/install-master.sh upgrade
sudo bash /opt/flux-3xui-orchestrator/install-master.sh backup
sudo bash /opt/flux-3xui-orchestrator/install-master.sh restore --backup-file /opt/flux-3xui-orchestrator/backups/flux-master-backup-YYYYMMDD-HHMMSS.tar.gz
sudo bash /opt/flux-3xui-orchestrator/install-master.sh uninstall --yes
```

If the installer script is not present locally, use the same raw GitHub command with `bash -s -- <action>`.

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

Useful checks:

```bash
systemctl status flux-agent.service
journalctl -u flux-agent.service -n 100 --no-pager
sudo -E /usr/local/bin/flux-agent.sh --once
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
- For ACME HTTP certificate mode, verify DNS points at the target server and port `80` is reachable before task creation.
- Verify duplicate protocol and forwarding ports before deploying to a shared host.
- Review task stdout/stderr before retrying failed deployment tasks.
- Review `监控告警` after every orchestration batch; acknowledge only after the remote service, certificate, task or traffic condition has been checked.
- Keep GHCR package visibility and tag policy aligned with the public README commands.

## Local And CI Verification

Use these before publishing a release candidate:

```bash
docker run --rm -v "$PWD/springboot-backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -DskipTests package
docker run --rm -v "$PWD:/workspace" -v flux_3xui_frontend_node_modules:/workspace/vite-frontend/node_modules -w /workspace/vite-frontend node:20-bookworm bash -lc "npm install --legacy-peer-deps --no-audit --no-fund && npm run build"
bash scripts/test-flux-agent-mock.sh
bash scripts/test-three-xui-fixture.sh
bash scripts/test-compose-smoke.sh --build-local --dry-run
bash scripts/test-compose-smoke.sh --build-local
```

The 3x-ui fixture test uses a short-lived local Python HTTP server, checks Bearer-token success/missing/wrong-token paths plus inbound/outbound/config/traffic/restart routes, and exits without leaving ports open. The full compose smoke test should remove its disposable containers, network and volumes when it exits. If it is interrupted, inspect Docker resources manually before rerunning.
