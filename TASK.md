# TASK.md

## Handoff Summary

当前目标：
- 继续朝 `flux-master` 单体主控架构推进：内置 Web UI、API、任务引擎、状态同步、Runtime Provider 层、MySQL/可选 SQLite，以及由 `flux-agent` 执行和回报的被控端闭环。
- 本轮已完成“操作审计日志”的本地实现和验证，下一步是提交推送并确认 GitHub Actions / GHCR 镜像成果。

已完成：
- 项目边界已锁定在 `C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator`，父级目录只作为存放根目录。
- 默认正式主控形态已是 `flux-master` 单体镜像，主控公网入口为 `5166/tcp`。
- Runtime Provider 已覆盖 `xui`、`snell`、`forward`、`certificate`、`firewall`。
- Agent 已通过任务 claim/report 执行 Xray/3x-ui、Snell、转发、防火墙、诊断、日志、升级等动作。
- SQLite 可选主控模式、单端口契约、真实 3x-ui E2E harness、agent 安全升级、runtime state/state sync 等能力已落地并推送过。
- 本轮已新增/修改 Operation Audit 相关后端实体、服务、API、schema、测试、前端 API/type/UI 和文档。
- 主控任务创建、编排、拒绝、状态更新、重试、删除、agent claim、agent report 已进入统一审计记录。
- agent report 审计只记录 stdout/stderr/resultJson 长度，不保存原始输出内容。

下一步：
- 提交并推送到 `origin/main` 和 `origin/future`。
- 检查 GitHub Actions：main/future CI、main/future Docker Images、main Pages。
- 确认 GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 已更新。

关键文件：
- `springboot-backend/src/main/java/com/admin/entity/OperationAuditLog.java`
- `springboot-backend/src/main/java/com/admin/common/dto/OperationAuditLogQueryDto.java`
- `springboot-backend/src/main/java/com/admin/config/OperationAuditSchemaInitializer.java`
- `springboot-backend/src/main/java/com/admin/controller/OperationAuditLogController.java`
- `springboot-backend/src/main/java/com/admin/service/OperationAuditLogService.java`
- `springboot-backend/src/main/java/com/admin/service/impl/OperationAuditLogServiceImpl.java`
- `springboot-backend/src/main/java/com/admin/service/impl/DeployTaskServiceImpl.java`
- `springboot-backend/src/main/resources/schema-sqlite.sql`
- `gost.sql`
- `vite-frontend/src/pages/orchestrator.tsx`
- `vite-frontend/src/api/index.ts`
- `vite-frontend/src/types/index.ts`
- `vite-frontend/src/i18n/index.tsx`
- `scripts/test-sqlite-schema.sh`
- `README.md`
- `README.zh-CN.md`
- `docs/OPERATIONS.md`
- `docs/RELEASE_NOTES.md`
- `docs/index.html`
- `PROJECT_CONTEXT.md`

验证状态：
- 已通过 `bash -n scripts/*.sh`。
- 已通过 `bash scripts/test-sqlite-schema.sh`。
- 已通过 `git diff --check`，仅有仓库既有 LF/CRLF 提示。
- 已通过 `npm run build`，仅有既有 Vite dynamic/static import chunk 提示。
- 已通过 Docker Maven targeted test：`RuntimeProviderServiceTest,DeployTaskServiceImplTest`，25 tests，0 failures。
- 本轮未跑完整 `bash scripts/release-check.sh`，避免继续长时间空转；最终以 GitHub Actions/Docker Images 远端门禁为准。

风险/待确认：
- 真实 VPS 矩阵和真实 3x-ui endpoint/token 的手动 E2E 记录仍是 1.0 前最大缺口。
- Snell 是产品层统一的独立 runtime，不是 3x-ui/Xray 内核原生协议。
- 企业级治理还缺 RBAC、审计保留/导出、agent token 过期/吊销、密钥轮换。
- UI 还需要继续打磨移动端、加载态、错误态和任务详情。

资源清理：
- 本轮未启动长期 dev server。
- 前端 build 未保留服务进程。
- Docker Maven 使用 `--rm`，已完成且不保留测试容器；保留 Maven 缓存卷 `flux-3xui-m2` 以加速后续本地验证。

最后更新：2026-05-26

## Active Tasks

- [x] **Goal:** 建立单体 `flux-master` 默认运行形态，主控入口收口到 `5166`。
- [x] **Goal:** 建立 Runtime Provider 层和 agent claim/report 执行闭环。
- [x] **Goal:** 完成 SQLite 可选主控模式和任务安全硬化。
- [ ] **Goal:** Operation Audit Log 已完成本地验证，待提交推送并确认 GitHub Actions / GHCR 镜像成果。
- [ ] **Goal:** 后续继续推进真实 VPS 矩阵、真实 3x-ui E2E 记录、UI polish 和安全治理。

## Notes For Next Agent

- 不要在父级存放根目录创建日志、计划或报告。
- 推送只面向 `origin`：`zhizhishu/flux-3xui-orchestrator`。
- 不要向 `upstream` / Flux Panel 作者仓库开 PR 或推送。
- 主控默认公网入口是 `5166`。
- 被控 agent 使用 `http://MASTER_IP:5166` 作为 `FLUX_PANEL_URL`，默认不暴露公网管理端口。
- 修改代码前先读 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`。
