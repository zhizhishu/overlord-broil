# Release Notes

## 0.6.0 - reliability gate

This release closes the product surface around Overlord Broil as one master image, one public master port and one controlled-agent execution loop. It is still below a `1.0` long-running stability promise, but the installer, agent and CI checks now catch more real-world setup problems before users send tasks to live servers.

### Highlights

- Supported deployments use `overlord-master` as the single master runtime. The Vite UI is embedded into the Spring Boot jar, and the default Compose files publish only `5166/tcp`.
- The master installer includes non-destructive `doctor`, backup, restore, upgrade and uninstall commands.
- SQLite mode is available through `OB_DB_MODE=sqlite` for small labs; MySQL remains the default production path.
- Controlled agents use systemd or OpenRC, poll the master, execute tasks locally and report results without opening an inbound management port.
- Product modules now cover inbound nodes, outbound/routing, Snell, forwarding/tunnels, certificates, traffic and settings logs.
- Deployment plans can install or reuse the node service, create starter protocol nodes, deploy Snell, run certificate/firewall checks and return service metadata.
- Node-core management includes inbound/client flows, config/outbound reads, traffic sync and service restart.
- Snell is represented as a normal product node while remaining an independent systemd/OpenRC service on the controlled host.
- Remote forwarding uses controlled-agent tasks to create, restart and remove `socat` services.
- Status sync aggregates latest runtime state plus heartbeat fields into the server cards and logs.
- Operation Audit records master task creation, rejection, state changes, retries, deletes, agent claims and agent reports.
- Agent maintenance includes diagnostics, logs, restart, upgrade, delayed uninstall, install checks, certificate checks, firewall checks and repair tasks.
- Dangerous actions require explicit UI confirmation and backend confirmation metadata before the agent can execute them.
- Nano host detection marks sub-200 MB hosts as `nano-critical` and blocks full Xray deployment on those machines.
- Install-matrix CI covers Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux userspaces.
- Release automation validates `VERSION`, runs `scripts/release-check.sh --full`, builds a tarball plus sha256 and publishes release assets for `v*` tags.

### Capability Matrix

| Area | 0.6.0 stance |
| --- | --- |
| Master install | One-command installer, preflight doctor and GHCR/source-build fallback. |
| Master runtime | Single `overlord-master` image on `5166/tcp`; optional SQLite mode. |
| Agent install | systemd/OpenRC service plus preflight doctor and runtime doctor. |
| Node service | API fixture in CI plus recorded `isrco-hk` real container write smoke. |
| Snell | Product-level protocol node backed by generated systemd/OpenRC services. |
| Remote forwarding | Auditable controlled-agent tasks for TCP/UDP forwarding. |
| Status sync | Runtime-state aggregation by server and module. |
| Operation Audit | Task and agent lifecycle audit in `operation_audit_log`. |
| Safety | Protected master ports, encrypted secrets, task audit, dangerous-action confirmation and nano-host blocking. |
| Verification | Shell syntax, agent mock, SQLite schema, controlled-node fixture, optional real controlled-node E2E, master port contract, frontend build, backend Maven build, install matrix and Compose smoke. |

### Ports

| Port | Default |
| --- | --- |
| `5166/tcp` | Public master Web/API and agent callback. |
| `6365/tcp` | Internal unless `OB_EXPOSE_BACKEND=1`. |
| `3306/tcp` | Docker network only. |
| phpMyAdmin | Not exposed unless `OB_PHPMYADMIN_PORT` is set. |
| Agent | No inbound management port. |
| Controlled-host business ports | Only the Xray, Snell, forwarding or ACME ports selected by the operator. |

### Validation Notes

- `isrco-hk` passed the single-container SQLite master smoke on `5166/tcp`.
- `isrco-hk` passed a real controlled-node add/toggle/delete contract against temporary high ports.
- The live Snell smoke script can create and delete a temporary Snell node and verify service shutdown plus closed listen port after cleanup.
- Docker/CI install matrix is useful for packaging confidence, but a wider real-VPS matrix is still required before a `1.0` claim.

### Honest Boundaries

- The Linux matrix is Docker/CI preflight coverage, not a full real-VPS matrix with public DNS, cloud firewall, ACME HTTP validation and real service managers.
- Node service has one recorded real-host container smoke; more host images and long-running cases are still needed.
- Snell remains a separate runtime service managed by the Overlord agent rather than a native Xray protocol.
- Sub-200 MB hosts should stay on Snell or forwarding unless swap and real-host testing prove otherwise.
- Enterprise governance is future work: RBAC, audit export/retention, key-rotation migration, agent token expiry/revocation and broader dangerous-operation policy.
