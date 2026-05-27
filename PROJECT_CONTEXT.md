# PROJECT_CONTEXT.md

## Stable Product Shape

Overlord Broil is an independent master/agent operations console for multi-server node deployment. It presents Xray/Reality, Snell, remote port forwarding, certificates, traffic snapshots, service status, diagnostics and agent maintenance as one control-plane workflow.

## Runtime

- Supported master runtime: single `overlord-master` image.
- Default public entry: `5166/tcp`.
- Backend debug port, MySQL and phpMyAdmin are internal unless explicitly exposed.
- Optional SQLite mode removes the MySQL sidecar for small labs.
- Controlled agents call the master URL and do not open an inbound management port.

## Core Modules

- `springboot-backend/src/main/java/com/admin/controller`: public API controllers.
- `springboot-backend/src/main/java/com/admin/service`: deployment, Xray Runtime, Snell, forwarding, agent task, traffic, alert and control-server services.
- `springboot-backend/src/main/java/com/admin/runtime`: Runtime Provider registry, action catalog and assignment logic.
- `scripts/install-master.sh`: master install, doctor, backup, restore, upgrade and uninstall.
- `scripts/install-agent.sh` and `scripts/overlord-agent.sh`: controlled-agent install and task runner.
- `vite-frontend/src/pages/control-center.tsx`: main operations console.
- `vite-frontend/src/i18n/index.tsx`: `zh-CN` / `en-US` dictionary.

## Product Contracts

- Xray Runtime public route: `/api/v1/runtimes/xray/*`.
- Deployment plan route: `/api/v1/deploy-task/plans`.
- Runtime state route: `/api/v1/deploy-task/runtime-state/overview`.
- Runtime Providers: `xrayRuntime`, `snell`, `forward`, `certificate`, `firewall`.
- Snell is managed as a product-level protocol node, but it remains a separate service on the controlled host.
- Xray Runtime connector paths are internal service contracts used by the connector and fixture. Do not rename them as product branding.

## Validation

Common local gate:

```bash
bash -n scripts/*.sh
sh -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh
bash scripts/test-master-port-contract.sh
bash scripts/test-agent-mock.sh
bash scripts/test-xray-runtime-fixture.sh
bash scripts/test-sqlite-schema.sh
cd vite-frontend && npm run build
docker run --rm -v "$PWD:/workspace" -v overlord-broil-m2:/root/.m2 -w /workspace/springboot-backend maven:3.9.9-eclipse-temurin-21 mvn -B "-Dtest=RuntimeProviderServiceTest,DeployTaskServiceImplTest,XrayRuntimeRouteContractTest" test
git diff --check
```

## Release Boundary

`0.6.0` is a public-trial / release-candidate build. A `1.0` claim still needs a wider real-VPS matrix, stronger certificate/firewall diagnostics, key rotation, RBAC and broader long-running operations testing.
