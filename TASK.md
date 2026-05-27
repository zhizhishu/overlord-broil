# TASK.md

## Current Goal

Close the repository into a single Overlord Broil product surface and push the installable state to `main` and `future`.

## Authorization

- Local Docker, GitHub Actions, Browser MCP, Serena Pool, ACE and subagents are allowed for validation.
- Termius access to `isrco-hk` is allowed when real-host verification is needed.
- Do not expose tokens, cookies, private keys, Xray Runtime secrets, Snell PSK values or generated agent tokens in logs, docs or final replies.

## Completed This Round

- Product naming is being closed around Overlord Broil, `overlord-master`, `overlord-agent`, Runtime Provider, State Sync and deployment plans.
- Public Xray Runtime route is `/api/v1/runtimes/xray/*`.
- Public deployment-plan route is `/api/v1/deploy-task/plans`.
- Default master entry is `5166/tcp`; backend, MySQL and phpMyAdmin stay internal unless explicitly exposed for maintenance.
- Controlled agents poll the master URL and do not require an inbound management port.
- Snell is managed as a product-level protocol node and remains an independent service on the controlled host.
- Low-memory hosts below `200 MB` are protected from full Xray deployment.

## In Progress

- Commit and push the verified closeout patch.

## Remaining

1. Finish residual naming scan and cleanup.
2. Run validation:
   - shell syntax and bootstrap syntax
   - `scripts/test-master-port-contract.sh`
   - `scripts/test-agent-mock.sh`
   - `scripts/test-xray-runtime-fixture.sh`
   - `scripts/test-sqlite-schema.sh`
   - frontend `npm run build`
   - targeted Docker Maven tests
   - `git diff --check`
3. Commit and push to `origin/main` and `origin/future`.
4. Check GitHub Actions and Pages after push.

## Validation Status

- Passed: shell syntax and bootstrap syntax.
- Passed: `scripts/test-master-port-contract.sh`.
- Passed: `scripts/test-agent-mock.sh`.
- Passed: `scripts/test-xray-runtime-fixture.sh`.
- Passed: `scripts/test-sqlite-schema.sh`.
- Passed: frontend `npm run build`.
- Passed: Docker Maven targeted tests for `RuntimeProviderServiceTest`, `DeployTaskServiceImplTest` and `XrayRuntimeRouteContractTest`.
- Passed: MySQL and SQLite Compose dry-run smoke.
- Passed: install matrix doctor for Debian 12, Ubuntu 24.04, Alpine 3.20, Rocky Linux 9 and Oracle Linux 9-slim.
- Passed: residual naming scan. Only `npm install --legacy-peer-deps` remains, as a dependency install flag.
- Passed: `git diff --check`.

## Risks

- Xray Runtime connector paths are internal service contracts and must not be blindly renamed.
- `isrco-hk` is a real server. Any temporary Snell or Xray Runtime test node must use high ports and be cleaned after validation.
