# TASK.md

## Current Goal

Close the Broil product flow for urgent use: one cohesive control center, simpler controlled-agent joining, easier protocol node creation, Snell as a first-class agent-executed node, and public docs/UI without exposed engineering layers.

## Authorization

- Local Docker, GitHub Actions, Browser MCP, Serena Pool, ACE, CodeSandbox skill and subagents are allowed for validation.
- Termius access to `isrco-hk` is allowed when real-host verification is needed.
- Do not expose tokens, cookies, private keys, node-service secrets, Snell PSK values or generated agent tokens in logs, docs or final replies.

## Completed This Round

- Ran two read-only subagent audits: one for the frontend product surface and one for backend/API/scripts/docs.
- Made `/control-center` the logged-in product entry and redirected old visible routes (`/dashboard`, `/forward`, `/tunnel`, `/node`, `/user`, `/profile`, `/limit`, `/config`) back to it.
- Reduced desktop and mobile navigation to the single Overlord Broil product entry.
- Simplified server registration UI so adding a server only asks for product-level fields and points the user to the generated one-command join flow.
- Simplified protocol-node creation: default view now asks for server, name, protocol, port and light node settings; transport/security/keys/outbound tags are behind an advanced switch.
- Simplified one-click deployment: default view emphasizes server selection and protocol bundle toggles; node-core credentials, listen IP and certificate internals are behind an advanced switch.
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
- Persisted the startup boundary receipt in `PROJECT_ID.md` and `AGENTS.md` so future turns do not need the project root repeated.
- Protected `/settings` behind the logged-in simple layout.
- Removed public README/Pages/frontend-bundle references to old runtime/provider wording, `node-core` wording, `XRAY_RUNTIME_*` examples and unused Runtime API i18n strings.
- Removed unused frontend runtime-provider API exports from the public API layer.
- Renamed frontend deployment-plan state to node-service product fields while mapping to the existing backend compatibility DTO at submit time.
- Updated the public screenshot copy to show protocol/node-service wording instead of internal service labels.

## Validation Status

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
- Browser preview was attempted through the in-app Browser plugin; the protected route needs a real login/local storage state, so visual proof is deferred to a live master session.

## Remaining

1. Commit and push the current changes to GitHub.
2. Let GitHub Actions build the public image.
3. Pull the new image on `isrco-hk` and run a browser/HK smoke with a real master login when remote validation is requested.

## Risks

- The join flow is now server-card based self-registration: the server record is created first, then the agent exchanges `OB_JOIN_TOKEN` for internal credentials automatically.
- Node-service connector paths are internal service contracts and must not be blindly renamed.
- Local host has no native Java/Maven; Docker Maven can be very slow on the Windows bind mount.
