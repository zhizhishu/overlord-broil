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

- Real UI evidence capture is complete. Browser MCP and Chrome DevTools verified the live `isrco-hk` console at `http://82.158.91.116:5166/?v=3437e2b#/orchestrator`.
- Captured screenshots:
  - `docs/assets/actual-login.png`
  - `docs/assets/actual-orchestrator-top.png`
  - `docs/assets/actual-orchestrator-full.png`
- README, Chinese README, GitHub Pages and release notes now reference the live UI screenshots.
- Real 3x-ui write validation is complete on `isrco-hk`:
  - started a temporary `ghcr.io/mhsanaei/3x-ui:latest` (`3x-ui 3.1.0`) container on the `overlord-network`.
  - direct `scripts/test-three-xui-e2e.sh` created, toggled and deleted temporary inbound port `42123`.
  - Overlord master API created, toggled and deleted temporary inbound port `42124`.
  - temporary 3x-ui container, API token file and test data were removed after validation.

## Remaining

1. Commit and push the real 3x-ui E2E compatibility fix plus validation notes to `origin/main` and `origin/future`.
2. Confirm GitHub Actions and Pages after push.
3. Broaden real VPS matrix beyond the current `isrco-hk` host before any `1.0` claim.

## Risks

- `isrco-hk` is a real server. Any temporary Snell/3x-ui node must use high test ports and be cleaned after validation.
- Snell and 3x-ui real tests may download upstream binaries or mutate service state.
- Screenshots must not include secrets, tokens or PSK values.
