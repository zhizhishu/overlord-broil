# TASK.md

## Handoff Summary

当前目标：继续朝用户给出的 `flux-master` 单体主控架构推进，把 `Task -> Agent -> Execute -> Report -> Master` 链路做实；Runtime Provider Action Catalog 和单端口主控契约均已完成本地验证、提交推送和远端 GitHub Actions / GHCR 镜像验证。

已完成：
- 已确认父级 `C:\Users\echo\Downloads\claude` 只是存放根目录，不在父级写日志或计划。
- 已确认真实项目根目录为 `C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator`。
- 已读取项目 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`；`serena.enabled=false`，不调用 Serena。
- 已完成并推送 `flux-master` 单体镜像里程碑：默认 `mysql + flux-master`，主控 Web UI/API 统一走 `5166`。
- 已完成并推送 Runtime Provider 注册表：`xui`、`snell`、`forward`、`certificate`、`firewall` 可枚举、可解析，任务和 Agent claim payload 已带 provider 元数据。
- 本轮已打通 Runtime Provider 到 Agent 执行报告的审计闭环：Agent 读取 claim payload 的 provider、日志标记 provider、report 写入 `resultJson.runtimeProvider`，后端保存 report 时兜底补 provider 审计元数据。
- 本轮已新增 `resultJson.runtimeState`：后端从服务、协议节点、转发规则、证书、诊断和任务状态统一解析 `status/statusSource`。
- 本轮已在主控任务卡展示运行时状态，覆盖 XUI、Snell、转发、证书、防火墙任务的统一状态模型。
- 本轮已同步 README、中文 README、Operations 和 Release Notes，说明 `runtimeState`、任务历史和 GHCR 可见性检查。
- 本轮已新增 State Sync 聚合接口 `/api/v1/deploy-task/runtime-state/overview`，按服务器和 Runtime Provider 汇总最新任务运行时状态，并用服务器心跳里的 XUI/Xray、Snell、证书状态补齐。
- 本轮已在主控 UI 增加 State Sync 面板，展示健康/观察/异常/未知统计、状态来源、服务 chip、任务编号、节点/转发/证书和诊断摘要。
- 已提交并推送 `f8adf8c Add runtime state sync overview` 到 `origin/main` 和 `origin/future`。
- 已确认 `f8adf8c` 的 GitHub Actions：main CI、main Docker Images、main Pages、future CI、future Docker Images 均成功。
- 已确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:82f5aa31d51b964fd45d1b5644303d6bebf3653600d16163bbd71222a62e5a42`，linux/amd64 digest `sha256:92e79daad1da2f1eab1c8131fadab4690c7803fbaf82952c9072a75757cb7261`。
- 已在 State Sync 行增加 Runtime Provider 诊断入口，按 provider 映射到 `install-diagnose`、`cert-diagnose`、`firewall-diagnose` 或 `doctor`。
- 已在 XUI/Snell State Sync 行增加修复入口，生成 `repair-xui`、`repair-xray` 或 `repair-snell` 的普通 `agent-maintenance` 任务。
- 已把 State Sync 来源元数据写入维护任务 `requestJson`，保留 provider、状态、来源任务和任务状态，方便后续 Agent 回报审计。
- 已提交并推送 `15cf59c Add state sync runtime actions` 到 `origin/main` 和 `origin/future`。
- 已确认 `15cf59c` 的 GitHub Actions：main CI、main Docker Images、main Pages、future CI、future Docker Images 均成功。
- 已确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:3daefd856e5f1b00d946ae15c75e26dc2d88a1885fca1a16f5090bfe77082e41`，linux/amd64 digest `sha256:56cec1c39a5e83aed1bd60e845beabb3284737d98fc14c3f565a11a51bb62b31`。
- 本轮已实现 `agent-maintenance logs` 结构化远端日志回传，任务结果新增 `logs.items`，覆盖 flux-agent、x-ui/Xray、Snell、转发服务和最近任务日志。
- 本轮已在主控任务卡增加“远端日志”摘要面板，并补齐中英文 i18n 文案。
- 本轮已同步 README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT，说明远端日志结构化回传和主控展示。
- 已提交并推送 `9d48422 Add structured remote runtime logs` 到 `origin/main` 和 `origin/future`。
- 已确认 `9d48422` 的 GitHub Actions：main CI、main Docker Images、main Pages、future CI、future Docker Images 均成功。
- 已确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:0e0cf174dd52961c233061e8fe1e0dbe1f64192b1abed3e13e4fdc1371a72939`，linux/amd64 digest `sha256:675c1d91788eb371492dc7ac7721c6185bcbae5297d8224ee23af671c2b15265`。
- 本轮已新增 `RuntimeProviderAction` / `actionCatalog`，让 `xui`、`snell`、`forward`、`certificate`、`firewall` 的 `agent-maintenance` 动作带 label、category、danger、stateSync 等元数据。
- 本轮已让 `DeployTaskServiceImpl.validateDeployTask` 复用 Runtime Provider Action Catalog 校验 `agent-maintenance` 动作，移除散落白名单。
- 本轮已让主控 State Sync 行诊断/修复动作和服务器卡片 Agent 按钮从 catalog 派生，并保留前端 fallback catalog 防止旧后端升级期按钮消失。
- 本轮已同步 README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT，说明 Action Catalog 是后端校验和主控按钮的统一动作契约。
- 已提交并推送 `bfff02e Add runtime provider action catalog` 到 `origin/main` 和 `origin/future`。
- 已确认 `bfff02e` 的 GitHub Actions：main CI、main Docker Images、main Pages、future CI、future Docker Images 均成功。
- 已确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:007b640226dc97b977f15f749a47d8af4db09262290d4cfe9aa16a6d78fb5668`，linux/amd64 digest `sha256:6c8055292c50e113d9eb5b47d2fb4150c49af22f973aa97f29fd8dfbaec9aafe`。
- 本轮已补强默认单端口主控契约：`install-master.sh` 安装/升级前会清理旧分离栈容器 `vite-frontend`、`springboot-backend`、`gost-phpmyadmin`，避免它们继续暴露 `80/6365/8066`。
- 本轮已新增 `scripts/test-master-port-contract.sh`，验证默认 `docker-compose.yml`、`docker-compose-v4.yml`、`docker-compose-v6.yml` 只公开一个 `flux-master` 主控入口。
- 本轮已把端口契约测试接入 GitHub Actions CI 和 `scripts/release-check.sh`。
- 本轮已同步 README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT，说明单端口主控、旧容器迁移清理和验证命令。
- 已提交并推送 `ca95d4b Tighten master single-port contract` 到 `origin/main` 和 `origin/future`。
- 已确认 `ca95d4b` 的 GitHub Actions：main CI、main Pages、future CI 均成功；手动触发的 main/future Docker Images 均成功。
- 已确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:6ac01a8f03dbf17187d2c8a3ed69514dd79e841ffea30c6b5b753abbe092ba31`，linux/amd64 digest `sha256:205667901f5dd3b59c765b56fca05dc4a52c948620e442a11de3ca0bc91bf240`。
- 本轮已新增真实 3x-ui E2E 合同烟测入口 `scripts/test-three-xui-e2e.sh`，支持真实 endpoint/token 的只读状态、入站和 Xray config 检查；显式写入模式支持创建、切换并删除临时 VLESS inbound。
- 本轮已新增手动 GitHub workflow `Real 3x-ui E2E`，可从 GitHub Actions 手动传入 endpoint/base path/write/port，并复用 repo secrets 中的 3x-ui token。
- 本轮已把可选真实 3x-ui E2E gate 接入 CI 和 `scripts/release-check.sh`；缺少真实 endpoint/token 时按设计 skip，不伪装成真机通过。
- 本轮已增强本地 3x-ui fixture：支持 form-urlencoded payload 和 `/panel/api/server/getConfigJson`，并让 fixture 测试反向调用真实 E2E 脚本验证读写路径。
- 本轮已同步 README、中文 README、Operations、Release Notes、GitHub Pages 和 PROJECT_CONTEXT，说明真实 3x-ui E2E 的使用方法、skip 语义和 1.0 前剩余真实运行证明。
- 已提交并推送 `f9691f4 Add real 3x-ui E2E contract gate` 到 `origin/main` 和 `origin/future`。
- 已确认 `f9691f4` 的 GitHub Actions：main CI、future CI、main Docker Images、future Docker Images、main Pages 均成功。
- 已确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:e7519039788a6ba54ec31fb4cc3b46864c9b774412894566be582d46533e15a3`，linux/amd64 digest `sha256:29fea0bd5ffa8c67ed505bdc13d9c01a782c6f72168a7db96e159ff58ea2ea69`。
- 本轮已补强 Agent 安全自动升级闭环：`flux-agent.sh --version`、升级前下载/非空/语法校验、SHA-256、旧二进制备份、staged install、重启计划和结构化 `maintenance.upgrade` 回报。
- 本轮已在主控任务卡增加 Agent 升级摘要面板，展示版本变化、语法校验、安装状态、重启计划、备份路径、SHA-256 和来源 URL。
- 本轮已同步 README、中文 README、Operations、Release Notes、GitHub Pages 和 PROJECT_CONTEXT，说明 Agent 安全升级生命周期。
- 已提交并推送 `e3c2eb9 Harden agent upgrade lifecycle` 到 `origin/main` 和 `origin/future`。
- 已确认 `e3c2eb9` 的 GitHub Actions：main CI、main Docker Images、main Pages、future CI、future Docker Images 均成功。
- 已确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:ada576e9e50190ede7e7c7c69688a044f28b28dd5cfe805d2f4a114b15aca18e`，linux/amd64 digest `sha256:13919ec75caa05f4e77d3a5651de8a5788b769d37739820fa50b984842f737c3`。
- 本轮已把 Xray/3x-ui 编排从占位 payload 推进为 Agent 可执行脚本：被控端解析 3x-ui endpoint/base path/token，调用 inbound add/delete 或 restart Xray API，并通过 `FLUX_AGENT_RESULT_JSON` 回传 inbound 元数据。
- 本轮已修正 Xray agent 回报脱敏：脚本执行仍使用 3x-ui API token，但任务结果只回传 `tokenConfigured`，不把 token 写入 `resultJson`。
- 本轮已补齐 Firewall Runtime Provider 的执行动作：`open-runtime-ports` / `close-runtime-ports` 可从 `requestJson` 解析运行时端口，尝试应用本机 `ufw`、`firewalld` 或 `iptables` 规则，并回传结构化诊断。
- 本轮已增强后端测试：生成的 Xray 和 firewall agent 脚本会被写入临时文件并执行 `bash -n`，防止 Java text block / shell 拼接错误。
- 本轮已同步 README、中文 README、Operations、Release Notes、GitHub Pages 和 PROJECT_CONTEXT，说明 Xray agent 执行和 firewall runtime port open/close 能力。

下一步：
- 提交并推送本轮 Xray agent 执行和 firewall runtime port 动作，让 GitHub 上保留 Actions/GHCR 结果。
- 后续在 repo secrets 配置真实 `THREE_XUI_E2E_URL` / `THREE_XUI_E2E_TOKEN` 后，手动运行 `Real 3x-ui E2E` workflow 取得真实 3x-ui 容器或 VPS 证明。

关键文件：
- `scripts/flux-agent.sh`
- `scripts/test-flux-agent-mock.sh`
- `springboot-backend/src/main/java/com/admin/service/impl/DeployTaskServiceImpl.java`
- `springboot-backend/src/main/java/com/admin/controller/DeployTaskController.java`
- `springboot-backend/src/main/java/com/admin/service/DeployTaskService.java`
- `springboot-backend/src/test/java/com/admin/service/impl/DeployTaskServiceImplTest.java`
- `springboot-backend/src/main/java/com/admin/runtime/*`
- `vite-frontend/src/api/index.ts`
- `vite-frontend/src/types/index.ts`
- `vite-frontend/src/pages/orchestrator.tsx`
- `vite-frontend/src/i18n/index.tsx`
- `.github/workflows/three-xui-e2e.yml`
- `scripts/test-three-xui-e2e.sh`
- `scripts/test-three-xui-fixture.sh`
- `scripts/three-xui-fixture.py`
- `scripts/release-check.sh`
- `README.md`
- `README.zh-CN.md`
- `docs/OPERATIONS.md`
- `docs/RELEASE_NOTES.md`
- `docs/index.html`
- `PROJECT_CONTEXT.md`

验证状态：
- 本轮 State Sync 行动作已通过 `npm run build`，仅有既有 Vite dynamic/static import chunk 提示。
- 本轮 State Sync 行动作已通过 `git diff --check`，仅有 Windows LF/CRLF 提示。
- 本轮 State Sync 行动作已通过临时 Vite preview HTTP 检查：`http://127.0.0.1:4173/` 返回 200。
- 本轮 State Sync 行动作已确认生产包包含 `运行时诊断`、`运行时修复` 和 `trigger: "state-sync"`。
- 本轮 State Sync 已通过 Docker Maven：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 11 个测试成功。
- 本轮 State Sync 已通过 `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'`。
- 本轮 State Sync 已通过 `bash scripts/test-flux-agent-mock.sh`。
- 本轮 State Sync 已通过 Docker Maven：`mvn -B -DskipTests package`。
- 本轮 State Sync 已通过 `git diff --check`，仅有 Windows LF/CRLF 提示。
- 本轮 State Sync 行动作已通过远端 GitHub Actions / GHCR 验证。
- 本轮远端日志已通过 `npm run build`，仅有既有 Vite dynamic/static import chunk 提示。
- 本轮远端日志已通过 Docker Maven：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 13 个测试成功。
- 本轮远端日志已通过 `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'`。
- 本轮远端日志已通过 `bash scripts/test-flux-agent-mock.sh`。
- 本轮远端日志已通过 `git diff --check`，仅有 Windows LF/CRLF 提示。
- 本轮远端日志已确认生产包包含 `远端日志` 和 `查看完整日志`，后端脚本包含 `FLUX_MAINTENANCE_LOG_LINES`、`capture_journal_log` 和 `payload["logs"]`。
- 本轮远端日志已通过远端 GitHub Actions / GHCR 验证。
- 本轮 Action Catalog 已通过 `npm run build`，仅有既有 Vite dynamic/static import chunk 提示。
- 本轮 Action Catalog 已通过 Docker Maven：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 16 个测试成功。
- 本轮 Action Catalog 已通过 `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'`。
- 本轮 Action Catalog 已通过 `bash scripts/test-flux-agent-mock.sh`。
- 本轮 Action Catalog 已通过 `git diff --check`，仅有 Windows LF/CRLF 提示。
- 本轮 Action Catalog 已通过远端 GitHub Actions / GHCR 验证：`bfff02e` 的 main/future CI 和 Docker Images 成功，main Pages 成功；GHCR latest index digest 为 `sha256:007b640226dc97b977f15f749a47d8af4db09262290d4cfe9aa16a6d78fb5668`。
- 本轮单端口契约已通过 `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'`。
- 本轮单端口契约已通过 `bash scripts/test-master-port-contract.sh`。
- 本轮单端口契约已通过 `bash scripts/install-master.sh doctor`。
- 本轮单端口契约已通过 `bash scripts/test-compose-smoke.sh --build-local --dry-run`。
- 本轮单端口契约已通过 `bash scripts/test-install-matrix.sh --image debian:12-slim`。
- 本轮单端口契约已通过 `git diff --check`，仅有 Windows LF/CRLF 提示。
- 本轮单端口契约已通过远端 GitHub Actions / GHCR 验证：`ca95d4b` 的 main/future CI 成功，main Pages 成功；手动 Docker Images run 成功并刷新 GHCR latest。
- 本轮真实 3x-ui E2E harness 已通过 `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'`。
- 本轮真实 3x-ui E2E harness 已通过 `bash scripts/test-three-xui-e2e.sh` 的无 endpoint/token skip 行为检查。
- 本轮真实 3x-ui E2E harness 已通过 `bash scripts/test-three-xui-fixture.sh`，其中 fixture 反打新脚本完成状态、入站、Xray config、临时 inbound 创建/切换/删除。
- 本轮真实 3x-ui E2E harness 已通过 `bash scripts/release-check.sh`，覆盖 shell、agent mock、3x-ui fixture + E2E fixture 反打、可选真实 E2E skip、compose config、master port contract、Docker Node 22 前端 build、compose dry-run 和 `git diff --check`。
- 本轮真实 3x-ui E2E harness 已通过远端 GitHub Actions / GHCR 验证：`f9691f4` 的 main/future CI 和 Docker Images 成功，main Pages 成功；GHCR latest index digest 为 `sha256:e7519039788a6ba54ec31fb4cc3b46864c9b774412894566be582d46533e15a3`。
- 本轮 Agent 安全升级已通过 `bash -lc 'bash -n scripts/*.sh'` 和 `bash -lc 'sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'`。
- 本轮 Agent 安全升级已通过 `bash scripts/test-flux-agent-mock.sh`，覆盖默认/覆盖版本输出、Agent doctor、成功任务和超时任务。
- 本轮 Agent 安全升级已通过 `npm run build`，仅有既有 Vite dynamic/static import chunk 提示。
- 本轮 Agent 安全升级已通过 Docker Maven：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 17 个测试成功。
- 本轮 Agent 安全升级已通过 `git diff --check`，仅有 Windows LF/CRLF 提示。
- 本轮 Agent 安全升级已通过 `bash scripts/release-check.sh`，覆盖 shell、agent mock、3x-ui fixture + E2E fixture 反打、可选真实 E2E skip、compose config、master port contract、Docker Node 22 前端 build、compose dry-run 和 `git diff --check`。
- 本轮 Xray/firewall runtime 执行已通过 Docker Maven clean test：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 19 个测试成功。
- 本轮 Agent 任务结果脱敏修正后已重新通过 Docker Maven targeted test：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 20 个测试成功。
- 本轮 Xray/firewall runtime 执行已通过 `bash -n scripts/*.sh`。
- 本轮 Xray/firewall runtime 执行已通过 `sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh`。
- 本轮 Xray/firewall runtime 执行已通过 `bash scripts/test-flux-agent-mock.sh`。
- 本轮 Xray/firewall runtime 执行已通过 `bash scripts/test-three-xui-fixture.sh`，fixture 完成 3x-ui 状态、入站、Xray config、临时 inbound 创建/切换/删除。
- 本轮 Xray/firewall runtime 执行已通过 `bash scripts/release-check.sh`，覆盖 shell、agent mock、3x-ui fixture + E2E fixture 反打、可选真实 E2E skip、compose config、master port contract、Docker Node 22 前端 build、compose dry-run 和 `git diff --check`。

风险/待确认：
- Runtime Provider 已是融合架构关键层；真实 3x-ui E2E harness 已具备，但还需要配置真实 endpoint/token 并跑出实际容器或 VPS 记录，不能把 skip 当真机证明。
- 真实 VPS 矩阵仍是正式 1.0 前最大缺口。
- Snell 是产品层统一、Agent 执行的独立 runtime，不是 Xray/3x-ui 内核原生协议。
- `future` 分支用于持续验证；正式 GHCR 镜像以 `main` 和 `v*` tag 为准。

资源清理：
- 本轮 Docker Maven 测试容器 `flux-state-sync-test` 使用 `--rm`，已结束且无残留。
- 本轮 Docker Maven package 容器 `flux-state-sync-package` 使用 `--rm`，已结束且无残留。
- 本轮 agent mock server 随脚本结束并清理临时目录。
- 本轮 State Sync 行动作启动过临时 Vite preview：`127.0.0.1:4173`，PID `11232`，验证后已停止；复查 `4173` 无监听输出。
- 本轮尝试使用内置浏览器验证时 `node_repl` 返回 `Transport closed`，已降级为 HTTP 和生产包检查；未保留可见浏览器页签。
- 本轮远端日志 Docker Maven 测试容器 `flux-remote-logs-test` 使用 `--rm`，已结束且无残留。
- 本轮远端日志 agent mock server 随脚本结束并清理临时目录。
- 本轮 Action Catalog Docker Maven 测试容器 `flux-action-catalog-test` 使用 `--rm`，已结束且无残留。
- 本轮 Action Catalog agent mock server 随脚本结束并清理临时目录。
- 本轮真实 3x-ui E2E fixture 反打启动的本地 Python fixture 随脚本退出清理；临时 inbound 已删除。
- 本轮 `release-check.sh` 使用 Docker Node 22 容器 `--rm` 运行，未保留容器；复查 `4173/5166/6365/12101` 无本轮端口监听。
- 本轮远端验证只使用 `gh` 和 Docker imagetools 读取/触发 GitHub Actions 与 GHCR；未启动本地服务、未占用端口、未创建持久容器。
- 本轮 Xray/firewall runtime 执行使用 Docker Maven 容器 `flux-runtime-provider-clean-test`、`flux-runtime-provider-ret-test` 和 `flux-runtime-provider-sanitize-test`，容器均使用 `--rm` 并已随测试成功退出；release-check 使用的 Docker Node 22 容器、agent mock 和 3x-ui fixture 脚本也已结束并清理临时资源。
- 本轮保留 Docker Desktop 和 Codex/Cursor/MCP 常驻进程；未关闭归属不明进程。

最后更新：2026-05-25 22:23:36 -07:00

## Active Tasks

- [x] **Goal:** 建立项目级 Agent 边界和上下文文件。
- [x] **Goal:** P0/P1 单体主控镜像和默认 Compose 落地。
- [x] **Goal:** 安装脚本、CI、文档同步到单体架构。
- [x] **Goal:** 提交、推送并确认 GitHub 镜像成果。
- [x] **Goal:** Runtime Provider 层、任务元数据和主控可视入口落地。
- [x] **Goal:** 打通 Runtime Provider 到 Agent 执行报告的审计闭环。
- [x] **Goal:** Runtime State 统一任务结果模型和主控任务卡展示落地。
- [x] **Goal:** 提交推送并确认 GitHub Actions / GHCR 成果。
- [x] **Goal:** State Sync 聚合 API 和主控状态面板落地。
- [x] **Goal:** 提交推送并确认 State Sync 的 GitHub Actions / GHCR 成果。
- [x] **Goal:** State Sync 面板直接发起 Runtime Provider 诊断/修复任务。
- [x] **Goal:** 提交推送并确认 State Sync 行动作的 GitHub Actions / GHCR 成果。
- [x] **Goal:** Agent 远端运行时日志结构化回传和主控展示。
- [x] **Goal:** Runtime Provider Action Catalog 统一动作清单、后端校验和主控触发入口。
- [x] **Goal:** 提交推送并确认 Action Catalog 的 GitHub Actions / GHCR 成果。
- [x] **Goal:** 收口默认单端口主控契约，并验证旧分离容器/端口不会干扰正式安装。
- [x] **Goal:** 提交推送并确认单端口主控契约的 GitHub Actions / GHCR 成果。
- [x] **Goal:** 新增真实 3x-ui E2E harness、手动 GitHub workflow、CI/release gate 接入和文档说明。
- [x] **Goal:** 推送并确认真实 3x-ui E2E harness 的 GitHub Actions / Pages / GHCR 镜像成果。
- [ ] **Goal:** 提交推送并确认真实 3x-ui E2E 远端验证记录的 GitHub Actions / GHCR 成果。
- [ ] **Goal:** 继续推进正式版缺口：真实 VPS 矩阵、真实 3x-ui endpoint 记录、UI polish、安全治理和 agent 自动升级。
- [x] **Goal:** 补强 Agent 安全自动升级闭环：版本探测、下载校验、备份、安装、重启计划和结构化结果回报。
- [x] **Goal:** 提交推送并确认 Agent 安全升级闭环的 GitHub Actions / Pages / GHCR 镜像成果。
- [x] **Goal:** Xray/3x-ui 编排任务从占位 payload 推进为 Agent 可执行 inbound add/delete/restart 脚本。
- [x] **Goal:** Firewall Runtime Provider 增加 `open-runtime-ports` / `close-runtime-ports` 真执行动作和测试覆盖。
- [ ] **Goal:** 提交推送并确认 Xray agent 执行与 firewall runtime port 动作的 GitHub Actions / Pages / GHCR 镜像成果。

## Notes For Next Agent

- 不要在父级存放根目录创建日志、计划或报告。
- 修改代码前先读 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`。
- 推送只面向 `origin`: `zhizhishu/flux-3xui-orchestrator`。
- 不要向 `upstream`: `zhizhishu/flux-panel` 推送或开 PR。
- 主控默认公网入口是 `5166`。
- 被控 Agent 使用 `http://MASTER_IP:5166` 作为 `FLUX_PANEL_URL`。
