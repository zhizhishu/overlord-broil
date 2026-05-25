# TASK.md

## Handoff Summary

当前目标：
继续朝用户给出的 `flux-master` 单体主控架构推进。本轮目标是把架构图里的 `Runtime Provider 层`落成真实模块，让主控可以枚举 XUI / Snell / Forward / Certificate / Firewall，并让任务创建、任务列表和 Agent 领取结果都带上 provider 元数据。

已完成：
- 已确认父级 `C:\Users\echo\Downloads\claude` 只是存放根目录，不在父级写日志或计划。
- 已确认真实项目根目录为 `C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator`。
- 已读取项目 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`；`serena.enabled=false`，不调用 Serena。
- 之前已完成并推送 `flux-master` 单体镜像里程碑：默认 `mysql + flux-master`，主控 Web UI/API 统一走 `5166`。
- 本轮已新增后端 Runtime Provider 注册表、分配对象、查询 API 和单元测试。
- 本轮已让 `DeployTask` 响应和 Agent claim payload 携带 `runtimeProvider` 元数据。
- 本轮已让前端主控页加载 Runtime Provider 注册表，展示 provider 卡片和任务 provider chip。
- 本轮已清理 README / README.zh-CN 公开入口文档，补充 Runtime Provider、端口、安装、API、GHCR、致谢和 1.0 差距说明。

下一步：
- 提交并只推送到 `origin/main` 和 `origin/future`，不要推送 `upstream`。
- 检查 GitHub Actions / GHCR，确认镜像成果在 GitHub 可见。

关键文件：
- `springboot-backend/src/main/java/com/admin/runtime/*`
- `springboot-backend/src/main/java/com/admin/controller/RuntimeProviderController.java`
- `springboot-backend/src/main/java/com/admin/entity/DeployTask.java`
- `springboot-backend/src/main/java/com/admin/service/impl/DeployTaskServiceImpl.java`
- `springboot-backend/src/test/java/com/admin/runtime/RuntimeProviderServiceTest.java`
- `vite-frontend/src/api/index.ts`
- `vite-frontend/src/types/index.ts`
- `vite-frontend/src/pages/orchestrator.tsx`
- `vite-frontend/src/i18n/index.tsx`
- `README.md`
- `README.zh-CN.md`
- `docs/OPERATIONS.md`
- `PROJECT_CONTEXT.md`

验证状态：
- 已通过一次 Docker Maven 单测：`RuntimeProviderServiceTest`，3 个测试全部成功。
- 已通过本轮 `git diff --check`，只有 Windows LF/CRLF 提示，无空白错误。
- 已通过 `bash -n scripts/*.sh` 和 bootstrap 脚本语法检查。
- 已通过前端 `npm run build`，仅有既有 Vite dynamic/static import chunk 提示。
- 已通过 Docker Maven `RuntimeProviderServiceTest`，3 个测试全部成功。
- 已通过 Docker Maven `mvn -B -DskipTests package`。

风险/待确认：
- Runtime Provider 是融合架构的关键层，但还不是完整 1.0。真实 VPS 矩阵和真实 3x-ui E2E 仍是正式版前最大缺口。
- Snell 仍是产品层统一、Agent 执行的独立 runtime，不是 Xray/3x-ui 内核原生协议。
- `future` 分支用于验证，正式 GHCR 镜像以 `main` 和 `v*` tag 为准。

资源清理：
- 上轮遗留 Maven Docker 测试容器已结束。
- 本轮慢速 bind-mount Maven 容器 `flux-runtime-provider-test-2` 已停止并清理。
- 本轮复制源码验证容器 `flux-backend-copy-verify` 使用 `--rm` 退出，无容器残留。

最后更新：
2026-05-25

## Active Tasks

- [x] **Goal:** 建立项目级 Agent 边界和上下文文件。
- [x] **Goal:** P0/P1 单体主控镜像和默认 Compose 落地。
- [x] **Goal:** 安装脚本、CI、文档同步到单体架构。
- [x] **Goal:** 提交、推送并确认 GitHub 镜像成果。
- [x] **Goal:** Runtime Provider 层、任务元数据和主控可见入口落地。
- [ ] **Goal:** 提交推送并确认 GitHub Actions / GHCR 成果。

## Notes For Next Agent

- 不要在父级存放根目录创建日志、计划或报告。
- 修改代码前先读 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`。
- 推送只面向 `origin`：`zhizhishu/flux-3xui-orchestrator`。
- 不要向 `upstream`：`zhizhishu/flux-panel` 推送或开 PR。
- 主控默认公网入口是 `5166`。
- 被控 Agent 使用 `http://MASTER_IP:5166` 作为 `FLUX_PANEL_URL`。
