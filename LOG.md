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
