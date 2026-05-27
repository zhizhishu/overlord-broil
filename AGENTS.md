# AGENTS.md

## Project Identity

- Project: `overlord-broil`
- Repository: `zhizhishu/overlord-broil`
- Local root: `C:\Users\echo\Downloads\claude\overlord-broil`
- Parent folder `C:\Users\echo\Downloads\claude` is only a storage root. Do not create plans, logs, reports, or project files there.
- This is an independent Overlord Broil project. Do not submit PRs to the upstream Flux Panel author repository.

## Required Startup Order

Read these files in order before code changes, tests, service startup, or remote pushes:

1. `PROJECT_ID.md`
2. `AGENTS.md`
3. `PROJECT_CONTEXT.md`
4. `TASK.md`
5. `LOG.md` only when history or verification context is needed

`TASK_LOG.md` is a legacy combined task/history file. Keep it as historical reference unless the user explicitly asks for a full migration.

## Write Boundaries

- Allowed write scope is this repository only.
- Do not write to the parent storage root.
- Do not modify sibling repositories unless the user explicitly names them.
- Do not commit generated build outputs, local secrets, `.env`, Maven `target`, `node_modules`, Vite build output, or Docker volumes.
- Keep secrets out of docs, logs, commits, and final answers.

## Development Rules

- Prefer the existing Overlord-style dense operations UI over landing-page or marketing layouts.
- Keep master-control behavior simple and auditable: the master creates tasks, the authorized agent pulls/executes/reports them.
- Preserve the default single public master entry: `5166/tcp`.
- Backend `6365`, MySQL `3306`, and phpMyAdmin are internal by default.
- Controlled agents should call the master panel URL, for example `http://MASTER_IP:5166`, not a backend debug port.
- Snell is unified at the product/node-management layer, but it remains an independent runtime service deployed by the agent, not a native Xray or Xray Runtime core protocol.
- Nano controlled hosts below `200 MB` memory should not run full Xray Runtime/Xray orchestration through the supported path.

## Validation

Use the smallest validation set that matches the change. Common commands:

```bash
bash -n scripts/*.sh
sh -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh
bash scripts/test-agent-mock.sh
bash scripts/test-xray-runtime-fixture.sh
bash scripts/test-compose-smoke.sh --build-local --dry-run
bash scripts/test-sqlite-schema.sh
bash scripts/test-compose-smoke.sh --compose-file docker-compose.sqlite.yml --build-local --dry-run
```

Frontend:

```bash
cd vite-frontend
npm install --legacy-peer-deps
npm run build
```

Backend:

```bash
cd springboot-backend
mvn -B -DskipTests package
```

Full release gate:

```bash
bash scripts/release-check.sh --full
```

When starting local services or compose smoke tests, record ports/PIDs, clean up containers/processes after verification, and report what remains.

## Git And Release

- Push only to `zhizhishu/overlord-broil`.
- Normal development branches: `main` for current installable state, `future` for ongoing validation.
- GHCR images are pushed from `main` and `v*` tags. `future` builds images for validation but does not push public release images.
- Before a user-facing release tag, run `scripts/release-check.sh --full` and build the release bundle.

## Language And Encoding

- Default conversation and project-facing notes: Simplified Chinese.
- Keep commands, identifiers, logs, and code names in their original language.
- Save files as UTF-8 without BOM.
