# LOG.md

## 2026-05-26 Product Closeout

- Completed: repository identity is now Overlord Broil, with supported deployment centered on the single `overlord-master` image and controlled `overlord-agent`.
- Completed: public master entry remains `5166/tcp`; backend, MySQL and phpMyAdmin are internal by default.
- Completed: controlled agents poll the master and do not expose a management port.
- Completed: Xray Runtime, Snell, forwarding, certificate and firewall actions are grouped under Runtime Provider, State Sync and deployment-plan workflows.
- Completed: Snell is represented as a normal product node while remaining an independent service on the controlled host.
- Completed: low-memory host detection blocks full Xray deployment below `200 MB`.
- Completed: removed old product-facing names and historical references from README, docs, release notes, UI text, scripts and project metadata.
- Completed: deleted the old combined task-history file and kept `TASK.md` / `LOG.md` as the short current handoff.
- Validation: shell syntax, master port contract, agent mock, Xray Runtime fixture, SQLite schema, frontend build, Docker Maven targeted tests, MySQL/SQLite Compose dry-run, install matrix doctor, residual naming scan and `git diff --check` passed.
- Pending: commit and push `main` plus `future`, then confirm GitHub Actions and Pages.

## 2026-05-27 Product Surface Tightening

- Completed: removed the remaining old surface / generic fallback wording from README, Pages SVG assets and frontend source naming.
- Completed: renamed frontend task-detail blocks to `*Block` to keep the Overlord product surface closed.
- Validation: public product-surface scan returned no matches for old upstream identity, legacy-route wording, split-layer product wording or stitched-product wording.
- Validation: frontend `npm run build` passed.

## 2026-05-27 HK Database Recovery

- Completed: restored `isrco-hk` MySQL service after the master was running without its database dependency.
- Completed: repaired the retained HK schema by adding missing Runtime columns and the traffic snapshot table, then restarted `overlord-master`.
- Completed: generalized backend startup schema repair with `OverlordSchemaInitializer` so old MySQL/SQLite installs can add missing product tables and columns during upgrade.
- Validation: public frontend and captcha check both returned `200`; HK compose reported `overlord-master` and `overlord-mysql` healthy.
- Validation: Docker Maven backend package build passed with tests skipped.
- Release: pushed commit `75a99c2` to `main` and `future`; GitHub Actions `CI` and `Docker Images` succeeded on both branches, and Pages succeeded on `main`.
- Release: upgraded `isrco-hk` with the new `latest` image; local and public captcha checks returned `200`.

## 2026-05-27 Broil Join And Node Flow

- Completed: added `/api/v1/agent-join/register` and changed server-card join commands to short-lived `OB_JOIN_TOKEN` self-registration.
- Completed: new server creation now immediately opens the full install command so the controlled host can be joined with one copied command.
- Completed: protocol-node creation now auto-generates UUID, Reality private key, Reality short id, Trojan/SS password and Snell PSK instead of leaving placeholder values for the user.
- Completed: protocol-node creation UI now hides passing checks and keeps only actionable warnings visible.
- Completed: kept Snell in the unified protocol-node flow while preserving agent execution and result reporting.
- Completed: replaced verbose request/response logging with sanitized logging that masks tokens, passwords, PSK, private keys, scripts and response data.
- Docs: updated README, README.zh-CN, operations docs and Pages copy for the join-command flow.
- Validation: frontend build, Docker Maven package, shell syntax, agent mock, SQLite schema, install matrix for Debian/Ubuntu/Alpine/Rocky/Oracle Linux and `git diff --check` passed.

## 2026-05-27 Broil 8-Module Surface

- Completed: simplified the control center into 8 product modules: dashboard, servers, inbound nodes, outbound/routing, forwarding/tunnels, traffic, certificates and settings.
- Completed: removed the old visible engineering console sections from the control-center JSX and kept detailed task/alert/audit information under the Settings log block.
- Completed: kept server joining simple with the existing join-command action and kept Snell as a first-class inbound-node protocol beside VLESS Reality, VMess, Trojan and Shadowsocks.
- Validation: frontend `npm run build` passed after the rewrite.
- Note: Browser preview was attempted through the in-app Browser plugin, but the protected route requires a real login/local storage state; visual smoke should be done against a running master session.

## 2026-05-27 Control Center Cleanup

- Completed: deleted the remaining old engineering console code from the control-center page, including runtime-provider state blocks, state-sync UI, diagnostic cards, raw inbound payload preview and the unused advanced inbound modal.
- Completed: kept the product surface focused on the 8 modules and the necessary product modals for server join, node creation, routing, forwarding, certificates and settings logs.
- Validation: frontend `npm run build`, `git diff --check` and product-surface keyword scan passed.
