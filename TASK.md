# TASK.md

## Current Goal

Close the Broil product flow for urgent use: one cohesive control center, simpler controlled-agent joining, easier protocol node creation, Snell as a first-class agent-executed node, and public docs/UI without exposed engineering layers.

## Authorization

- Local Docker, GitHub Actions, Browser MCP, Serena Pool, ACE, CodeSandbox skill and subagents are allowed for validation.
- Termius access to `isrco-hk` is allowed when real-host verification is needed.
- Do not expose tokens, cookies, private keys, node-service secrets, Snell PSK values or generated agent tokens in logs, docs or final replies.

## Completed This Round

- Fixed the live node-service failure path behind the user-reported `127.0.0.1:2053` error: backend errors now explain loopback/Docker, wrong port, refused connection and the required "deploy/repair node service" action instead of returning raw Java exceptions.
- Added Docker `host.docker.internal:host-gateway` support to every master compose file for same-host master/agent repair cases while still warning users not to use `127.0.0.1` for remote controlled servers.
- Moved the 8-module control-center navigation into the left sidebar under the Overlord Broil entry and removed the disliked top module grid from the content page.
- Added server-card and outbound/routing repair actions when a controlled server has no node-service endpoint, a loopback endpoint or an unhealthy service state.
- Added a compact "node service connection" editor in the server modal so endpoint/base path/token/user/password can be fixed from the UI, and protected existing node-service fields from being cleared by blank update payloads.
- Added backend tests for loopback connection messaging and blank-field preservation.
- Ran two read-only subagent audits: one for the frontend product surface and one for backend/API/scripts/docs.
- Made `/control-center` the logged-in product entry and redirected old visible routes (`/dashboard`, `/forward`, `/tunnel`, `/node`, `/user`, `/profile`, `/limit`, `/config`) back to it.
- Reduced desktop and mobile navigation to the single Overlord Broil product entry.
- Simplified server registration UI so adding a server only asks for product-level fields and points the user to the generated one-command join flow.
- Simplified protocol-node creation: default view now asks for server, name, protocol, port and light node settings; transport/security/keys/outbound tags are behind an advanced switch.
- Simplified one-click deployment: default view emphasizes server selection and protocol bundle toggles; node-service credentials, listen IP and certificate internals are behind an advanced switch.
- Disabled the old `/api/v1/node/install` long-lived token install route with HTTP 410 guidance toward the join-token flow.
- Updated README, Chinese README, operations docs, release notes and GitHub Pages copy so the public product is described as one 8-module Overlord Broil surface instead of engineering/provider layers.
- Added `/api/v1/agent-join/register` and short-lived join-token install commands so each controlled host can join with one command.
- Added frontend `Join Command` action and auto-opened the install command after creating a controlled server.
- Simplified protocol-node creation by auto-generating UUID, Trojan/SS password, Reality private key, Reality short id and Snell PSK when the user leaves placeholders.
- Simplified the protocol-node modal so it shows only missing/warning checks instead of a full wall of passing checks.
- Kept Snell in the same protocol-node creation flow, backed by the existing agent task execution and status report path.
- Replaced request/response logging with a sanitized logger that masks tokens, passwords, PSK, private keys, scripts, stdout/stderr and response data.
- Updated README, Chinese README, operations docs and GitHub Pages text for the generated join-command flow.
- Simplified the control center surface into 8 product modules: dashboard, servers, inbound nodes, outbound/routing, forwarding/tunnels, traffic, certificates and settings.
- Removed the old visible engineering console sections from the control-center page; detailed events now surface through the Settings log block.
- Kept Snell as a first-class inbound-node option beside VLESS Reality, VMess, Trojan and Shadowsocks.
- Removed the remaining old engineering console code paths from the control-center page, including runtime-provider state blocks, diagnostic cards, raw inbound payload preview and hidden advanced inbound modal.
- Persisted the startup boundary receipt, MCP need and subagent allowance in `PROJECT_ID.md` and `AGENTS.md` so future turns do not need the project root repeated.
- Protected `/settings` behind the logged-in simple layout.
- Removed public README/Pages/frontend-bundle references to old runtime/provider wording, node-service wording leaks, `XRAY_RUNTIME_*` examples and unused Runtime API i18n strings.
- Removed unused frontend runtime-provider API exports from the public API layer.
- Renamed frontend deployment-plan state to node-service product fields while mapping to the existing backend compatibility DTO at submit time.
- Updated the public screenshot copy to show protocol/node-service wording instead of internal service labels.
- Completed another parallel read-only audit pass for frontend/docs and backend/API leakage risks.
- Removed old public control-center PNG screenshots and switched README/GitHub Pages to the current 8-module product SVG.
- Removed remaining public product-surface wording for protocol profiles, raw results, full routing config, visible provider terms and internal payload labels.
- Removed unused frontend exports for old profile and manual deploy-task APIs.
- Changed Snell protocol-node and server-forward responses to return a safe deploy-task summary instead of full `DeployTask` entities with scripts or request JSON.
- Changed `/api/v1/capabilities/list` and `/api/v1/capabilities/resolve` to HTTP 410 because the service registry is internal.
- Extended request/response log masking for `requestJson`, `resultJson`, `rawResultJson`, `detailJson` and common embedded secret patterns.
- Removed raw task fields and provider DTOs from the frontend public type layer.
- Moved the authenticated remote node-service API from the old runtime route to `/api/v1/node-service/*`.
- Removed unused manual deploy-task public endpoints and the old profile controller from the authenticated API surface.
- Updated README and Chinese README so public API examples only show product routes.
- Renamed frontend node-service API/type identifiers away from the old node-core wording while keeping the same 8-module UI.
- Added a command-line controlled-agent uninstall path to `scripts/install-agent.sh` with explicit `uninstall --yes`.
- Persisted actual controlled-agent service/script/env paths into the agent env file for future maintenance tasks.
- Updated master-side `uninstall-agent` maintenance generation so UI-triggered controlled-agent removal deletes systemd/OpenRC service files, the agent script, credentials and `/var/lib/overlord-agent`.
- Updated the master installer migration guard to remove obsolete stopped `overlord-mysql` containers in SQLite mode, matching the older `gost-mysql` cleanup.
- Added live control-center screenshots for login, dashboard, servers, inbound nodes, outbound/routing, forwarding/tunnels, traffic, certificates and settings.
- Updated README and Chinese README with UI screenshot links and clarified master CLI uninstall, controlled-agent CLI uninstall, UI `Uninstall Agent` and master-side `Delete record` behavior.
- Reinstalled/refreshed the master on `isrco-hk`, removed the old `/opt/flux-3xui-orchestrator` install, and verified the same host runs master plus controlled agent for smoke testing.

## Validation Status

- Passed after node-service/UI repair: `npm run build` in `vite-frontend`.
- Passed after node-service/UI repair: `bash -n scripts/*.sh`, bootstrap `sh -n`, master port contract, agent mock and SQLite schema.
- Passed after node-service/UI repair: Docker Maven backend package build with tests skipped.
- Passed after node-service/UI repair: Docker Maven tests `XrayRuntimeServiceImplTest` and `ControlServerServiceImplTest`.
- Passed after node-service/UI repair: `bash scripts/test-xray-runtime-fixture.sh`.
- Passed after node-service/UI repair: targeted `git diff --check` for all changed files.
- Passed after push: GitHub Actions `CI`, `Docker Images` and `Pages` for commit `61f9246`.
- Passed on `isrco-hk`: upgraded to the new image, generated repair task `8`, agent installed the node service on `5168`, rewrote the bad `127.0.0.1:2053` endpoint to `https://host.docker.internal:5168/ob-1`, and `/node-service/config`, `/node-service/outbounds`, `/node-service/outbounds/traffic`, `/node-service/traffic/sync` all returned code `0`.
- Passed: `npm run build` in `vite-frontend` after the route/UI simplification.
- Passed: `bash -n scripts/*.sh` and bootstrap `sh -n`.
- Passed: `bash scripts/test-master-port-contract.sh`.
- Passed: `bash scripts/test-agent-mock.sh`.
- Passed: `bash scripts/test-sqlite-schema.sh`.
- Passed: `git diff --check`.
- Passed: public product-surface keyword scan for old visible engineering terms after this cleanup.
- Attempted: Docker Maven `mvn -B -DskipTests package`; stopped after javac produced no output for about 10 minutes on the Windows bind mount, and the container was cleaned up.
- Passed: `npm run build` in `vite-frontend`.
- Passed: Docker Maven backend package build with tests skipped.
- Passed: `bash -n scripts/*.sh`.
- Passed: `bash scripts/test-agent-mock.sh`.
- Passed: `bash scripts/test-sqlite-schema.sh`.
- Passed: `bash scripts/test-install-matrix.sh` across Debian 12, Ubuntu 24.04, Alpine 3.20, Rocky Linux 9 and Oracle Linux 9 userspaces.
- Passed: `git diff --check`.
- Passed again after the 8-module control-center rewrite: `npm run build` in `vite-frontend`.
- Passed after deleting old engineering console remnants: `npm run build`, `git diff --check`, and product-surface keyword scan.
- Passed after product-surface tightening: `npm run build`.
- Passed after product-surface tightening: `bash -n scripts/*.sh` and bootstrap `sh -n`.
- Passed after product-surface tightening: `bash scripts/test-master-port-contract.sh`.
- Passed after product-surface tightening: `bash scripts/test-agent-mock.sh`.
- Passed after product-surface tightening: `bash scripts/test-sqlite-schema.sh`.
- Passed after product-surface tightening: `git diff --check`.
- Passed after product-surface tightening: public product-surface keyword scan across README, docs, frontend source and built dist.
- Passed after latest cleanup: public product-surface keyword scan across README, docs, frontend source, backend source and scripts for old visible engineering terms.
- Passed after latest cleanup: `npm run build` in `vite-frontend`.
- Passed after latest cleanup: `bash -n scripts/*.sh`.
- Passed after latest cleanup: `bash -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh`.
- Passed after latest cleanup: `bash scripts/test-master-port-contract.sh`.
- Passed after latest cleanup: `bash scripts/test-agent-mock.sh`.
- Passed after latest cleanup: `bash scripts/test-sqlite-schema.sh`.
- Passed after latest cleanup: Docker Maven backend package build with tests skipped.
- Passed after latest cleanup: `bash scripts/test-xray-runtime-fixture.sh`.
- Passed after latest cleanup: `bash scripts/test-compose-smoke.sh --build-local --dry-run`.
- Passed after latest cleanup: `bash scripts/test-install-matrix.sh` across Debian 12, Ubuntu 24.04, Alpine 3.20, Rocky Linux 9 and Oracle Linux 9 userspaces.
- Passed after latest cleanup: `git diff --check`.
- GitHub Actions after commit `4896f34`: Pages and Docker Images passed, backend CI failed because contract tests still expected old provider naming and old overview keys.
- Fixed the backend contract tests to match the productized Node Service naming and `serviceKey` overview response.
- Fixed deploy-task result sanitizing so `*Configured` boolean flags are not redacted by the generic sensitive-key pass.
- Passed after CI fix: Docker Maven contract tests `RuntimeProviderServiceTest`, `DeployTaskServiceImplTest`, `XrayRuntimeRouteContractTest` with 28 tests.
- Browser preview was attempted through the in-app Browser plugin; the protected route needs a real login/local storage state, so visual proof is deferred to a live master session.
- Passed after API surface close: public keyword scan for old visible engineering/API terms.
- Passed after API surface close: `npm run build` in `vite-frontend`.
- Passed after API surface close: `bash -n scripts/*.sh`.
- Passed after API surface close: `bash -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh`.
- Passed after API surface close: `bash scripts/test-master-port-contract.sh`.
- Passed after API surface close: `bash scripts/test-agent-mock.sh`.
- Passed after API surface close: `bash scripts/test-sqlite-schema.sh`.
- Passed after API surface close: Docker Maven contract tests `RuntimeProviderServiceTest`, `DeployTaskServiceImplTest`, `XrayRuntimeRouteContractTest` with 28 tests.
- Passed after API surface close: `git diff --check`.
- Passed after uninstall/docs/live-UI update: `npm run build` in `vite-frontend`.
- Passed after uninstall/docs/live-UI update: `bash -n scripts/*.sh`, bootstrap `sh -n`, `bash scripts/test-master-port-contract.sh`, `bash scripts/test-agent-mock.sh`, `bash scripts/test-sqlite-schema.sh`, and `git diff --check`.
- Passed after uninstall/docs/live-UI update: Docker Maven backend package build with tests skipped using JDK 21.
- Passed on `isrco-hk`: old Flux install removed, `/opt/overlord-broil` present, only public Overlord port `5166/tcp` listening, `/` returned 200, `/flow/test` returned 200, `overlord-master` container healthy, and `overlord-agent` systemd service active with about 10 MB memory.
- Verified: live UI screenshots under `docs/assets/live-*.png` show the current Overlord Broil product surface; an initially wrong login screenshot was replaced with the verified Overlord Broil login image.

## Remaining

No required work remains for the current productization goal after this local and `isrco-hk` smoke pass.

Optional next hardening outside this goal:

1. Run a browser screenshot pass against the logged-in HK UI after the user reviews the new sidebar placement.
2. Add broader long-running real-VPS soak tests before claiming `1.0` commercial stability.

## Risks

- The join flow is now server-card based self-registration: the server record is created first, then the agent exchanges `OB_JOIN_TOKEN` for internal credentials automatically.
- Node-service connector paths are internal service contracts and must not be blindly renamed.
- Local host has no native Java/Maven; Docker Maven can be very slow on the Windows bind mount.
- Current GitHub `main` head before this live-UI/uninstall commit is `e521e21`; push and Actions status still need to be recorded after the final commit.
