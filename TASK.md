# TASK.md

## Current Goal

Fix the HK master login captcha/database failure, harden old-database upgrades, and push the installable fix to `main` and `future`.

## Authorization

- Local Docker, GitHub Actions, Browser MCP, Serena Pool, ACE and subagents are allowed for validation.
- Termius access to `isrco-hk` is allowed when real-host verification is needed.
- Do not expose tokens, cookies, private keys, Xray Runtime secrets, Snell PSK values or generated agent tokens in logs, docs or final replies.

## Completed This Round

- Restored `isrco-hk` MySQL service and restarted `overlord-master`.
- Repaired the retained HK MySQL schema by adding missing Runtime columns and the traffic snapshot table.
- Verified public frontend and captcha status endpoint now return `200`.
- Replaced the narrow audit-table initializer with an Overlord schema initializer that creates missing product tables, adds missing `control_server` columns, and migrates old runtime column values into the current fields.

## In Progress

- Run final local validation, commit, push `main` and `future`, then confirm GitHub Actions.

## Remaining

1. Run shell/schema/whitespace checks.
2. Commit and push to `origin/main` and `origin/future`.
3. Check GitHub Actions after push.

## Validation Status

- Passed: HK public frontend `200`.
- Passed: HK public captcha check `200`, body reports success.
- Passed: HK compose shows `overlord-master` and `overlord-mysql` healthy.
- Passed: Docker Maven backend package build with tests skipped.
- Passed: shell syntax and bootstrap syntax through `bash -n`.
- Passed: `scripts/test-sqlite-schema.sh`.
- Passed: `git diff --check`.

## Risks

- Xray Runtime connector paths are internal service contracts and must not be blindly renamed.
- `isrco-hk` is a real server. Any temporary Snell or Xray Runtime test node must use high ports and be cleaned after validation.
- Local host has no native Java/Maven; backend validation uses Docker Maven and is slow on the Windows bind mount.
