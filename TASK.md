# TASK.md

## Current Goal

Push the project toward the pre-1.0 goals requested by the user:

1. Strengthen real-host and system-matrix validation.
2. Validate real 3x-ui write E2E behavior.
3. Validate Snell as a real master-managed protocol node through the agent.
4. Capture and polish the control-console UI in the Flux-inspired Overlord Broil direction.

## Authorization

- Termius access to `isrco-hk` is allowed for this task.
- Browser MCP is allowed for real console UI operation and screenshots.
- Serena Pool, ACE and subagents are allowed for parallel audit.
- Local Docker and GitHub Actions may be used for validation.
- Do not expose tokens, cookies, private keys, 3x-ui secrets, Snell PSK values or generated agent tokens in logs, docs or final replies.

## Current Baseline

- Repository: `https://github.com/zhizhishu/overlord-broil`
- Local root: `C:\Users\echo\Downloads\claude\overlord-broil`
- Previous pushed baseline: `4f00f18` on `main` and `future`.
- `isrco-hk` baseline before this round:
  - `overlord-master` was healthy.
  - Public entry: `http://82.158.91.116:5166`.
  - `/flow/test` returned `test`.
  - Default public listeners were only `5166/tcp` and SSH `22/tcp`.
  - `overlord-agent.service` was active.
  - Legacy split containers were absent.

## Completed This Round

- Parallel audits completed for CI/Docker gates, UI routes/screenshots and 3x-ui/Snell/VPS runtime paths.
- Local validation passed:
  - shell syntax for `scripts/*.sh`
  - bootstrap syntax
  - `scripts/test-agent-mock.sh`
  - `scripts/test-three-xui-fixture.sh`
  - `scripts/test-master-port-contract.sh`
  - `scripts/test-sqlite-schema.sh`
  - frontend `npm run build`
  - `git diff --check`
- Added `scripts/test-snell-real-smoke.sh` for master API -> protocol node -> agent -> Snell service -> runtime overview smoke testing.
- Found a real Snell runtime bug on `isrco-hk`: generated Snell configs were `600 root` while services ran as `nobody`, and the task could still be reported as succeeded.
- Fixed Snell generated scripts:
  - config files are chowned to `nobody` when available.
  - install/restart now assert the service is active before reporting success.
- Cleaned temporary failed Snell smoke artifacts on `isrco-hk`.
- Found and fixed the live blank-console root cause: `vite-frontend/toFile.mjs` removed `type="module"` script tags after build, so the served HTML loaded CSS but no app JavaScript.
- UI polish:
  - added stable `data-testid` hooks for the control center, key panels, server cards and 3x-ui/Agent action groups.
  - replaced native `window.confirm` dangerous-action prompts with an in-app confirmation modal.
- Current hardening pass:
  - Snell delete scripts now fail if the service remains active or the listen port stays open.
  - Snell failed/timeout agent reports now write protocol-node `failed` / `delete_failed` plus `lastError`.
  - `scripts/test-snell-real-smoke.sh` now verifies cleanup after temporary-node deletion.
  - source default Spring Boot port now matches the product single-entry port `5166`.
  - control-center delete/restart/outbound-save flows now use an in-app confirmation modal.

## In Progress

- Docker Maven Java 21 targeted tests `RuntimeProviderServiceTest,DeployTaskServiceImplTest` passed: 25 tests, 0 failures.
- Frontend `npm run build`, shell syntax, agent mock, 3x-ui fixture, master port contract and SQLite schema tests passed after the current hardening pass.
- After push, rebuild/redeploy the master image, then rerun `scripts/test-snell-real-smoke.sh` against `isrco-hk` on the updated master.
- Use Browser MCP to capture real console screenshots into `docs/assets/`.

## Remaining

1. Rerun Snell real smoke after the patched master is deployed.
2. Run or record real 3x-ui write E2E against a real endpoint if a safe endpoint/token is available; otherwise keep fixture write E2E as the current local proof.
3. Capture UI screenshots from the actual `http://82.158.91.116:5166/#/orchestrator` console.
4. Update README, Operations, Release Notes, Pages and LOG.
5. Commit and push to `origin/main` and `origin/future`.
6. Confirm GitHub Actions and GHCR image result after push.

## Risks

- `isrco-hk` is a real server. Any temporary Snell/3x-ui node must use high test ports and be cleaned after validation.
- Snell and 3x-ui real tests may download upstream binaries or mutate service state.
- Screenshots must not include secrets, tokens or PSK values.
