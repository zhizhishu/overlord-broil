# TASK.md

## Handoff Summary

当前目标：
- 继续朝 `flux-master` 单体主控架构推进：内置 Web UI、API、任务引擎、状态同步、Runtime Provider 层、MySQL/可选 SQLite，以及由 `flux-agent` 执行和回报的被控端闭环。
- 本轮已完成“操作审计日志”的本地实现、验证、提交、推送和 GHCR 镜像补推。

已完成：
- 项目边界已锁定在 `C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator`，父级目录只作为存放根目录。
- 默认正式主控形态已是 `flux-master` 单体镜像，主控公网入口为 `5166/tcp`。
- Runtime Provider 已覆盖 `xui`、`snell`、`forward`、`certificate`、`firewall`。
- Agent 已通过任务 claim/report 执行 Xray/3x-ui、Snell、转发、防火墙、诊断、日志、升级等动作。
- SQLite 可选主控模式、单端口契约、真实 3x-ui E2E harness、agent 安全升级、runtime state/state sync 等能力已落地并推送过。
- 本轮已新增/修改 Operation Audit 相关后端实体、服务、API、schema、测试、前端 API/type/UI 和文档。
- 主控任务创建、编排、拒绝、状态更新、重试、删除、agent claim、agent report 已进入统一审计记录。
- agent report 审计只记录 stdout/stderr/resultJson 长度，不保存原始输出内容。
- `origin/main` 和 `origin/future` 均已推送到 `f6381606c7410e1d8b89c6b93aaecbfbf210697f`。
- GHCR 已确认：
  - `flux-3xui-orchestrator-master:latest/main/sha-f638160` -> `sha256:4ebde7a773d5521ac5d262f5ae7b1ca7360bbec96ebd0d843cf20214f92e28b5`
  - `flux-3xui-orchestrator-backend:latest/main/sha-f638160` -> `sha256:0623605b60acbfaacd35c3e60beff16c2d686d141afed6a1d03d988a2b45af41`
  - `flux-3xui-orchestrator-frontend:latest/main/sha-f638160` -> `sha256:b7ea04d1081d21f6e00287087543eb65de89d67fcd7f6d21abd647291febdbbd`

下一步：
- 继续推进真实 VPS 矩阵、真实 3x-ui E2E 记录、UI polish 和安全治理。

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
- `gh run list --commit f6381606c7410e1d8b89c6b93aaecbfbf210697f` 未返回 Actions run；已用本地 Docker buildx 手动补推并用 `docker buildx imagetools inspect` 验证 GHCR 三镜像。
- 前端镜像重建时 `npm run build` 在 Docker 内通过，仅有既有 Vite dynamic/static import chunk 提示。
- 记录提交 `1fc801068ec3df0d8b329f4560bc40f140bd9182` 推送后，`main CI` run `26448892387` 成功；`future CI` run `26448900654` 初次受 GitHub checkout/action 下载 403 影响失败，重跑失败项后成功；Pages run `26448891539` 初次下载官方 action 失败，重跑后成功。

风险/待确认：
- 真实 VPS 矩阵和真实 3x-ui endpoint/token 的手动 E2E 记录仍是 1.0 前最大缺口。
- Snell 是产品层统一的独立 runtime，不是 3x-ui/Xray 内核原生协议。
- 企业级治理还缺 RBAC、审计保留/导出、agent token 过期/吊销、密钥轮换。
- UI 还需要继续打磨移动端、加载态、错误态和任务详情。

资源清理：
- 本轮未启动长期 dev server。
- 前端 buildx 镜像构建未保留服务进程；保留 buildx builder 容器 `buildx_buildkit_halowebui-multi0` 作为 Docker buildx 基础设施。
- Docker Maven 使用 `--rm`，已完成且不保留测试容器；保留 Maven 缓存卷 `flux-3xui-m2` 以加速后续本地验证。

最后更新：2026-05-26

## Active Tasks

- [x] **Goal:** 建立单体 `flux-master` 默认运行形态，主控入口收口到 `5166`。
- [x] **Goal:** 建立 Runtime Provider 层和 agent claim/report 执行闭环。
- [x] **Goal:** 完成 SQLite 可选主控模式和任务安全硬化。
- [x] **Goal:** Operation Audit Log 已完成本地验证、提交推送和 GHCR 镜像成果确认。
- [ ] **Goal:** 后续继续推进真实 VPS 矩阵、真实 3x-ui E2E 记录、UI polish 和安全治理。

## Notes For Next Agent

- 不要在父级存放根目录创建日志、计划或报告。
- 推送只面向 `origin`：`zhizhishu/flux-3xui-orchestrator`。
- 不要向 `upstream` / Flux Panel 作者仓库开 PR 或推送。
- 主控默认公网入口是 `5166`。
- 被控 agent 使用 `http://MASTER_IP:5166` 作为 `FLUX_PANEL_URL`，默认不暴露公网管理端口。
- 修改代码前先读 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`。
