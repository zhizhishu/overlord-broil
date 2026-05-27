# TASK.md

## Current Goal

Close the Broil product flow for urgent use: simpler controlled-agent joining, easier protocol node creation, Snell as a first-class agent-executed node, and safer logs.

## Authorization

- Local Docker, GitHub Actions, Browser MCP, Serena Pool, ACE, CodeSandbox skill and subagents are allowed for validation.
- Termius access to `isrco-hk` is allowed when real-host verification is needed.
- Do not expose tokens, cookies, private keys, Xray Runtime secrets, Snell PSK values or generated agent tokens in logs, docs or final replies.

## Completed This Round

- Added `/api/v1/agent-join/register` and short-lived join-token install commands so each controlled host can join with one command.
- Added frontend `Join Command` action and auto-opened the install command after creating a controlled server.
- Simplified protocol-node creation by auto-generating UUID, Trojan/SS password, Reality private key, Reality short id and Snell PSK when the user leaves placeholders.
- Simplified the protocol-node modal so it shows only missing/warning checks instead of a full wall of passing checks.
- Kept Snell in the same protocol-node creation flow, backed by the existing agent task execution and status report path.
- Replaced request/response logging with a sanitized logger that masks tokens, passwords, PSK, private keys, scripts, stdout/stderr and response data.
- Updated README, Chinese README, operations docs and GitHub Pages text for the generated join-command flow.

## Validation Status

- Passed: `npm run build` in `vite-frontend`.
- Passed: Docker Maven backend package build with tests skipped.
- Passed: `bash -n scripts/*.sh`.
- Passed: `bash scripts/test-agent-mock.sh`.
- Passed: `bash scripts/test-sqlite-schema.sh`.
- Passed: `bash scripts/test-install-matrix.sh` across Debian 12, Ubuntu 24.04, Alpine 3.20, Rocky Linux 9 and Oracle Linux 9 userspaces.
- Passed: `git diff --check`.

## Remaining

1. Commit and push the current changes to GitHub.
2. Let GitHub Actions build the public image.
3. Pull the new image on `isrco-hk` and run a browser/HK smoke if the user wants another real-host proof cycle.

## Risks

- The join flow is now server-card based self-registration: the server record is created first, then the agent exchanges `OB_JOIN_TOKEN` for internal credentials automatically.
- Xray Runtime connector paths are internal service contracts and must not be blindly renamed.
- Local host has no native Java/Maven; backend validation uses Docker Maven and is slow on the Windows bind mount.
