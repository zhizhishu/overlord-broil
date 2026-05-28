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

## 2026-05-27 Product Entry And Join Cleanup

- Completed: ran parallel read-only audits for frontend product fit and backend/API/scripts/docs product boundaries.
- Completed: made `/control-center` the logged-in product entry and redirected old visible routes back to the Overlord Broil control center.
- Completed: reduced desktop and mobile navigation to the single Overlord Broil product entry.
- Completed: simplified server registration, protocol-node creation and one-click deployment by moving advanced runtime, key and routing fields behind advanced switches.
- Completed: disabled the old `/api/v1/node/install` long-lived-token install route with a 410 response that points to the join-token flow.
- Docs: updated README, README.zh-CN, operations docs, release notes and Pages text around the 8-module product surface and node-service wording.
- Validation: frontend `npm run build`, shell syntax, master port contract, agent mock, SQLite schema, product-surface keyword scan and `git diff --check` passed.
- Note: Docker Maven package on the Windows bind mount was attempted, but javac produced no output for about 10 minutes; the test container was stopped and cleaned up.

## 2026-05-27 Public Product Surface Closure

- Completed: persisted the default project startup receipt in `PROJECT_ID.md` and `AGENTS.md` so future work starts inside `C:\Users\echo\Downloads\claude\overlord-broil` without repeating the boundary by hand.
- Completed: protected `/settings`, removed unused frontend runtime-provider API exports and removed old Runtime API / runtime registry i18n strings from the frontend bundle.
- Completed: renamed deployment-plan frontend state to node-service product fields while keeping the backend compatibility DTO mapping at submit time.
- Completed: cleaned README, Chinese README, operations docs, release notes, Pages copy and screenshot text so public docs describe Overlord Broil as one product surface.
- Validation: frontend `npm run build`, shell syntax, master port contract, agent mock, SQLite schema, product-surface keyword scan across source and built dist, and `git diff --check` passed.

## 2026-05-28 Productization Goal Close

- Completed: closed the 8-module Overlord Broil product surface around dashboard, servers, inbound nodes, outbound/routing, forwarding/tunnels, traffic, certificates and settings.
- Completed: removed stale public screenshots and switched README / Pages to the current Overlord Broil product SVG.
- Completed: kept Snell as a first-class protocol node while leaving it as an agent-managed service on controlled hosts.
- Completed: tightened public API responses so protocol-node and forwarding operations return deploy-task summaries instead of full task scripts or request/result JSON.
- Completed: made `/api/v1/capabilities/*` internal-only with HTTP 410 responses and expanded request/result log redaction.
- Validation: frontend build, shell syntax, bootstrap syntax, master port contract, agent mock, SQLite schema, node-service fixture, compose dry-run, Docker Maven package, Docker Maven backend contract tests and Debian/Ubuntu/Alpine/Rocky/Oracle install matrix passed.
- Release: pushed `4896f34` and `1f885f6` to `main`; GitHub Actions `CI`, `Docker Images` and `Pages` all succeeded for `1f885f6`.

## 2026-05-28 API Surface Close

- Completed: moved the authenticated remote node-service API to `/api/v1/node-service/*` and retired the old runtime route from the product contract.
- Completed: removed unused manual deploy-task endpoints and deleted the old profile controller from the authenticated API surface.
- Completed: updated README, Chinese README and project context so public API examples only show product routes.
- Completed: renamed frontend node-service API/type identifiers away from old node-core wording.
- Validation: public keyword scan, frontend build, shell syntax, bootstrap syntax, master port contract, agent mock, SQLite schema, Docker Maven backend contract tests and `git diff --check` passed.
- Release: pushed `a9e0ca2` to `main`; GitHub Actions `CI`, `Docker Images` and `Pages` all succeeded for that commit.

## 2026-05-28 Live UI And Uninstall Smoke

- Completed: added controlled-agent CLI uninstall with `install-agent.sh uninstall --yes`, plus path persistence for agent script/env/service files.
- Completed: tightened the master UI `uninstall-agent` task so it removes the controlled service, script, credentials and `/var/lib/overlord-agent`.
- Completed: updated master migration cleanup for obsolete `overlord-mysql` containers in SQLite mode.
- Completed: refreshed README and README.zh-CN with live UI screenshot links and clear master/controlled uninstall instructions.
- Completed: replaced the incorrect live login screenshot and added verified current UI screenshots for the 8 product modules.
- Remote smoke: on `isrco-hk`, removed the old `/opt/flux-3xui-orchestrator` install, verified `/opt/overlord-broil`, healthy `overlord-master`, active `overlord-agent`, only public `5166/tcp`, and HTTP 200 for `/` plus `/flow/test`.
- Validation: frontend build, shell syntax, bootstrap syntax, master port contract, agent mock, SQLite schema, `git diff --check`, and Docker Maven package with JDK 21 passed.

## 2026-05-28 Node Service Repair And Sidebar Navigation

- Completed: productized node-service connection failures so loopback Docker endpoints, refused ports, timeouts and DNS failures return actionable repair guidance instead of raw Java exceptions.
- Completed: protected existing node-service endpoint/base path/token/user/password fields from being cleared by blank server-edit payloads.
- Completed: moved the 8-module navigation under the left sidebar Overlord Broil entry and removed the content-top module grid.
- Completed: added server-card and outbound/routing repair buttons plus a server-modal node-service connection editor for fixing outbounds/routing/traffic from the UI.
- Completed: added `host.docker.internal:host-gateway` to all master compose files for same-host repair cases.
- Validation: frontend `npm run build`, shell syntax, bootstrap syntax, master port contract, agent mock, SQLite schema, node-service fixture, Docker Maven package and the two new Docker Maven tests passed.
- Release: pushed `61f9246` to `main`; GitHub Actions `CI`, `Docker Images` and `Pages` all succeeded.
- Remote smoke: upgraded `isrco-hk`, created repair task `8`, verified the controlled agent installed node service on `5168`, rewrote the stale `127.0.0.1:2053` endpoint to `https://host.docker.internal:5168/ob-1`, and confirmed config, outbound, outbound traffic and traffic sync APIs returned code `0`.
