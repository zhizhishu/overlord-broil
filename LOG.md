# LOG.md

## 2026-05-25

### Project Agent Context Bootstrap

- 完成：为项目建立 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md` 和 `LOG.md`，明确父级目录只是存放根目录。
- 修改：记录项目边界、读写范围、验证命令、推送目标和不要向 upstream 开 PR 的规则。
- 验证：只新增项目上下文和接力文档，未改业务代码。
- 后续：新任务继续使用项目内 `TASK.md` / `LOG.md` 接力。

### Flux Master Single-Image Runtime Milestone

- 完成：把默认运行形态收敛为 `mysql + flux-master`，主控 Web UI 和 API 由同一个 Spring Boot 进程在 `5166` 提供。
- 修改：更新根 `Dockerfile`、Compose、安装脚本、release 脚本、CI、Docker Images workflow、README、中文 README、Operations、Release Notes 和项目上下文。
- 验证：通过 compose config、shell syntax、agent mock、3x-ui fixture、dry-run compose smoke 和真实 Docker smoke；真实 smoke 中 `/flow/test` 与公共入口 `http://127.0.0.1:18080/` 均通过。
- 推送：已推送 `ad9bb2e Add flux-master single image runtime` 到 `origin/main` 和 `origin/future`。
- 清理：Docker smoke 自动删除测试容器、网络、卷；复查 `18080` 无监听。

### Runtime Provider Registry Milestone

- 完成：新增 Runtime Provider 层，主控可枚举并解析 `xui`、`snell`、`forward`、`certificate`、`firewall` 五类运行时。
- 修改：
  - 后端新增 `RuntimeProviderDescriptor`、`RuntimeProviderAssignment`、`RuntimeProviderService` 和 `RuntimeProviderController`。
  - `DeployTask` 增加非数据库字段 `runtimeProvider`。
  - `DeployTaskServiceImpl` 在创建、重试、列表、脚本读取和 Agent claim payload 中挂载 provider 元数据。
  - 前端新增 Runtime Provider API/type，主控页展示 provider 卡片、任务数量和任务 provider chip。
  - README / README.zh-CN / Operations / Release Notes / PROJECT_CONTEXT 更新为可公开阅读的 Runtime Provider、端口、安装、API、GHCR 和致谢说明。
- 验证：
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
  - `bash -n scripts/*.sh` 和 bootstrap 脚本语法检查通过。
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - Docker Maven `RuntimeProviderServiceTest` 通过，3 个测试全部成功。
  - Docker Maven `mvn -B -DskipTests package` 通过。
- 推送：已推送 `fb2556d Add runtime provider registry` 到 `origin/main` 和 `origin/future`。
- 清理：慢速 bind-mount Maven 容器 `flux-runtime-provider-test-2` 已停止并清理；复制源码验证容器 `flux-backend-copy-verify` 使用 `--rm` 退出，无容器残留。
- 后续：打通 Runtime Provider 到 Agent 执行报告的审计闭环，再检查 GitHub Actions 与 GHCR 镜像状态。

### Runtime Provider Agent Report Audit

- 完成：打通 Runtime Provider 从主控 claim 到 Agent 执行报告的审计闭环。
- 修改：
  - `scripts/flux-agent.sh` 读取 claim payload 中的 `runtimeProvider`，执行日志标记 provider，并在 running/final report 的 `resultJson.runtimeProvider` 中回传。
  - `DeployTaskServiceImpl` 保存 Agent report 时兜底补写 Runtime Provider 元数据，旧 Agent 没上报时仍能保留审计信息。
  - `scripts/test-flux-agent-mock.sh` 增加 provider claim payload，并断言 running/final report 都带 `runtimeProvider.key=snell`。
  - 新增 `DeployTaskServiceImplTest` 覆盖后端兜底、保留 Agent 上报 provider、非 JSON 结果包装三种情况。
  - README、中文 README、Release Notes、PROJECT_CONTEXT 更新 Runtime Provider claim/report 审计说明。
- 验证：
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - Docker Maven `RuntimeProviderServiceTest,DeployTaskServiceImplTest` 通过，6 个测试全部成功。
  - Docker Maven `mvn -B -DskipTests package` 通过。
- 清理：Docker 验证容器 `flux-backend-provider-audit-verify` 使用 `--rm`，无残留；agent mock 临时服务已结束；`5166/5168/6365/8066` 未发现本轮遗留监听。
- 后续：提交并推送到 `origin/main` 和 `origin/future`，再检查 GitHub Actions 与 GHCR 镜像状态。

### Runtime State Task Result Model

- 完成：新增统一 `resultJson.runtimeState` 任务结果模型，让 XUI、Snell、转发、证书和防火墙任务共用一套运行时状态视图。
- 修改：
  - `DeployTaskServiceImpl` 保存 Agent report 时生成 `runtimeState`，包含 provider、协议/动作、任务状态、解析后的 `status/statusSource`、服务状态、节点数量、转发数量、证书状态和诊断摘要。
  - `DeployTaskServiceImplTest` 新增服务/节点、诊断摘要和旧 Agent 兼容覆盖，验证运行时状态兜底逻辑。
  - 前端新增 `RuntimeState` 类型，主控任务卡展示运行时状态、来源、节点/转发/证书摘要、服务 chip 和诊断摘要。
  - README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT 补充 `runtimeState`、任务历史和 GHCR 可见性说明。
- 验证：
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - Docker Maven `RuntimeProviderServiceTest,DeployTaskServiceImplTest` 通过，8 个测试全部成功。
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - Docker Maven `mvn -B -DskipTests package` 通过。
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- 清理：Docker 验证容器 `flux-runtime-state-verify`、`flux-runtime-state-package` 使用 `--rm`，无残留；agent mock 临时服务已结束。
- 后续：提交并推送 `origin/main` 和 `origin/future`，等待 GitHub Actions / GHCR 镜像结果。

### State Sync Runtime Overview

- 完成：新增 State Sync 运行时聚合视图，把单个任务的 `resultJson.runtimeState` 提升为“服务器 × Runtime Provider”的主控状态面板。
- 修改：
  - `DeployTaskController` / `DeployTaskService` 新增 `/api/v1/deploy-task/runtime-state/overview`。
  - `DeployTaskServiceImpl` 聚合最新任务运行时状态，并用 `control_server` 心跳里的 XUI/Xray、Snell、证书字段补齐基础状态。
  - `DeployTaskServiceImplTest` 新增 runtimeState 提取、任务聚合项、心跳种子状态和健康计数覆盖。
  - 前端新增 API/type，主控中心增加 State Sync 面板，展示健康/观察/异常/未知统计、来源、服务 chip、任务编号、节点/转发/证书和诊断摘要。
  - README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT 补充 State Sync 聚合接口和 UI 说明。
- 验证：
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - Docker Maven `RuntimeProviderServiceTest,DeployTaskServiceImplTest` 通过，11 个测试全部成功。
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - Docker Maven `mvn -B -DskipTests package` 通过。
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- 清理：Docker Maven 测试容器 `flux-state-sync-test`、package 容器 `flux-state-sync-package` 均使用 `--rm`，无残留；agent mock 临时服务随脚本结束；本阶段未启动长期 dev server。
- 推送：已推送 `f8adf8c Add runtime state sync overview` 到 `origin/main` 和 `origin/future`。
- 远端验证：`f8adf8c` 的 main CI、main Docker Images、main Pages、future CI、future Docker Images 均成功；GHCR `flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:82f5aa31d51b964fd45d1b5644303d6bebf3653600d16163bbd71222a62e5a42`，linux/amd64 digest `sha256:92e79daad1da2f1eab1c8131fadab4690c7803fbaf82952c9072a75757cb7261`。
- 后续：让 State Sync 面板可直接发起 Runtime Provider 诊断/修复任务，继续打通 `State -> Task -> Agent -> Report` 运维闭环。

### State Sync Runtime Actions

- 完成：State Sync 行现在可以直接创建 Runtime Provider 诊断任务；XUI/Snell 行也可以创建对应修复任务。
- 修改：
  - `vite-frontend/src/pages/orchestrator.tsx` 增加 provider 到诊断/修复 action 的映射。
  - `createAgentMaintenance` 支持附加 State Sync 触发元数据，并保留 `source: orchestrator-ui`。
  - State Sync 行增加 `运行时诊断` 和 `运行时修复` 按钮，继续复用普通 `agent-maintenance` 部署任务链路。
  - README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT 补充 State Sync 行动作说明。
- 验证：
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
  - 临时 Vite preview `http://127.0.0.1:4173/` 返回 HTTP 200，生产包中已确认包含 `运行时诊断`、`运行时修复` 和 `trigger: "state-sync"`。
- 清理：临时 preview 进程 PID `11232` 已停止，复查 `4173` 无监听输出；内置浏览器验证时 `node_repl` 返回 `Transport closed`，已降级为 HTTP 和生产包检查，未保留可见浏览器页签。
- 推送：已推送 `15cf59c Add state sync runtime actions` 到 `origin/main` 和 `origin/future`。
- 远端验证：`15cf59c` 的 main CI、main Docker Images、main Pages、future CI、future Docker Images 均成功；GHCR `flux-3xui-orchestrator-master:latest` 更新到 index digest `sha256:3daefd856e5f1b00d946ae15c75e26dc2d88a1885fca1a16f5090bfe77082e41`，linux/amd64 digest `sha256:56cec1c39a5e83aed1bd60e845beabb3284737d98fc14c3f565a11a51bb62b31`。
- 后续：实现 Agent 远端运行时日志结构化回传和主控展示，继续补齐 `Agent -> Execute -> Report -> Master` 运维闭环。

### Agent Remote Runtime Logs

- 完成：`agent-maintenance logs` 现在会结构化回传 `logs.items`，覆盖 flux-agent、x-ui/Xray、Snell、转发服务和最近任务日志；主控任务卡新增“远端日志”摘要面板。
- 修改：
  - `DeployTaskServiceImpl` 的维护脚本新增 `LOG_FILE`、日志行数上限、systemd/OpenRC 日志采集、最近任务日志采集和 `payload["logs"]` 输出。
  - `DeployTaskServiceImplTest` 覆盖 `logs.items` 在 runtime 元数据兜底时不丢失，并验证生成脚本包含结构化日志采集链路。
  - `vite-frontend/src/pages/orchestrator.tsx` 新增远端日志解析和任务卡摘要面板，`vite-frontend/src/i18n/index.tsx` 补齐英文文案。
  - README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT 补充远端日志说明。
- 验证：
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - Docker Maven `RuntimeProviderServiceTest,DeployTaskServiceImplTest` 通过，13 个测试全部成功。
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
  - 生产包已确认包含 `远端日志` 和 `查看完整日志`；后端脚本已确认包含 `FLUX_MAINTENANCE_LOG_LINES`、`capture_journal_log` 和 `payload["logs"]`。
- 清理：Docker Maven 容器 `flux-remote-logs-test` 使用 `--rm`，已结束无残留；agent mock 临时服务随脚本结束；本阶段未启动长期 dev server。
- 后续：提交并推送到 `origin/main` 和 `origin/future`，再检查 GitHub Actions 与 GHCR 镜像状态。
