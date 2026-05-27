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
