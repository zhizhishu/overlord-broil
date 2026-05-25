# TASK.md

## Handoff Summary

当前目标：继续朝用户给出的 `flux-master` 单体主控架构推进，把 `Task -> Agent -> Execute -> Report -> Master` 链路做实；本轮已把 Runtime Provider 执行报告升级为统一 `runtimeState` 状态模型，下一步提交推送并确认 GitHub Actions / GHCR 镜像成果。

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

下一步：
- 提交本轮改动。
- 推送到 `origin/main` 和 `origin/future`。
- 检查 GitHub Actions / GHCR 镜像成果。

关键文件：
- `scripts/flux-agent.sh`
- `scripts/test-flux-agent-mock.sh`
- `springboot-backend/src/main/java/com/admin/service/impl/DeployTaskServiceImpl.java`
- `springboot-backend/src/test/java/com/admin/service/impl/DeployTaskServiceImplTest.java`
- `springboot-backend/src/main/java/com/admin/runtime/*`
- `vite-frontend/src/types/index.ts`
- `vite-frontend/src/pages/orchestrator.tsx`
- `vite-frontend/src/i18n/index.tsx`
- `README.md`
- `README.zh-CN.md`
- `docs/OPERATIONS.md`
- `docs/RELEASE_NOTES.md`
- `PROJECT_CONTEXT.md`

验证状态：
- 本轮已通过 `npm run build`。
- 本轮已通过 Docker Maven：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 8 个测试成功。
- 本轮已通过 `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'`。
- 本轮已通过 `bash scripts/test-flux-agent-mock.sh`，mock 中 running/final report 均断言带 `runtimeProvider.key=snell`。
- 本轮已通过 Docker Maven：`mvn -B -DskipTests package`。
- 本轮已通过 `git diff --check`，仅有 Windows LF/CRLF 提示。

风险/待确认：
- Runtime Provider 已是融合架构关键层，但真实 VPS 矩阵和真实 3x-ui E2E 仍是正式 1.0 前最大缺口。
- Snell 是产品层统一、Agent 执行的独立 runtime，不是 Xray/3x-ui 内核原生协议。
- `future` 分支用于持续验证；正式 GHCR 镜像以 `main` 和 `v*` tag 为准。

资源清理：
- 本轮 Docker Maven 验证容器 `flux-runtime-state-verify`、`flux-runtime-state-package` 使用 `--rm`，已结束且无残留。
- 本轮 agent mock server 随脚本结束并清理临时目录。
- 已复查 `5166`、`5168`、`6365`、`8066`，未发现本轮遗留监听。

最后更新：2026-05-25 14:02:49 -07:00

## Active Tasks

- [x] **Goal:** 建立项目级 Agent 边界和上下文文件。
- [x] **Goal:** P0/P1 单体主控镜像和默认 Compose 落地。
- [x] **Goal:** 安装脚本、CI、文档同步到单体架构。
- [x] **Goal:** 提交、推送并确认 GitHub 镜像成果。
- [x] **Goal:** Runtime Provider 层、任务元数据和主控可视入口落地。
- [x] **Goal:** 打通 Runtime Provider 到 Agent 执行报告的审计闭环。
- [x] **Goal:** Runtime State 统一任务结果模型和主控任务卡展示落地。
- [ ] **Goal:** 提交推送并确认 GitHub Actions / GHCR 成果。

## Notes For Next Agent

- 不要在父级存放根目录创建日志、计划或报告。
- 修改代码前先读 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`。
- 推送只面向 `origin`: `zhizhishu/flux-3xui-orchestrator`。
- 不要向 `upstream`: `zhizhishu/flux-panel` 推送或开 PR。
- 主控默认公网入口是 `5166`。
- 被控 Agent 使用 `http://MASTER_IP:5166` 作为 `FLUX_PANEL_URL`。
