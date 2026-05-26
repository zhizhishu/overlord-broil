# LOG.md

## 2026-05-26

### Operation Audit Remote Image Verification

- 完成：确认 Operation Audit Log 已推送到 `origin/main` 和 `origin/future`，两条分支均指向 `f6381606c7410e1d8b89c6b93aaecbfbf210697f`。
- 镜像：手动确认并补齐 GHCR 镜像标签，`master`、`backend`、`frontend` 均已有 `latest`、`main`、`sha-f638160`。
- 验证：
  - `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest/main/sha-f638160` index digest 为 `sha256:4ebde7a773d5521ac5d262f5ae7b1ca7360bbec96ebd0d843cf20214f92e28b5`。
  - `ghcr.io/zhizhishu/flux-3xui-orchestrator-backend:latest/main/sha-f638160` index digest 为 `sha256:0623605b60acbfaacd35c3e60beff16c2d686d141afed6a1d03d988a2b45af41`。
  - `ghcr.io/zhizhishu/flux-3xui-orchestrator-frontend:latest/main/sha-f638160` index digest 为 `sha256:b7ea04d1081d21f6e00287087543eb65de89d67fcd7f6d21abd647291febdbbd`。
  - 前端 Docker build 内部 `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
- 注意：`gh run list --commit f6381606c7410e1d8b89c6b93aaecbfbf210697f` 未返回 Actions run，因此本次以手动 Docker buildx push 和 `imagetools inspect` 作为镜像成果证明。
- Actions：远端验证记录提交 `1fc801068ec3df0d8b329f4560bc40f140bd9182` 已推送到 `main` 和 `future`；`main CI` run `26448892387` 成功，`future CI` run `26448900654` 初次受 GitHub checkout/action 下载 403 影响失败，重跑失败项后成功，Pages run `26448891539` 初次下载官方 action 失败，重跑后成功。
- 清理：未启动本地 dev server，未占用 `5166/5168/6365/8066` 等项目端口；保留 Docker buildx builder 容器 `buildx_buildkit_halowebui-multi0`。
- 后续：继续推进真实 VPS 矩阵、真实 3x-ui E2E 记录、UI polish、安全治理和镜像发布自动化稳定性。

### Operation Audit Log

- 完成：新增主控操作审计日志能力，覆盖 deploy task 创建、编排、拒绝、状态更新、重试、删除、agent claim 和 agent report。
- 修改：新增 `operation_audit_log` MySQL/SQLite schema、启动自动建表、后端实体/Mapper/Service/Controller、主控任务审计写入、前端 Operation Audit 面板、中英文 README/Operations/Pages/Release Notes 说明。
- 安全：agent report 审计只记录 stdout/stderr/resultJson 长度，不写入原始日志；master 侧 actor 从 JWT 请求上下文解析，无请求上下文时明确记录为 `master-unknown`。
- 验证：`bash -n scripts/*.sh`、`bash scripts/test-sqlite-schema.sh`、`git diff --check`、`npm run build` 通过；Docker Maven targeted test `RuntimeProviderServiceTest,DeployTaskServiceImplTest` 通过，25 tests、0 failures。
- 清理：本轮未启动长期 dev server；Docker Maven 使用 `--rm`，测试容器已退出；保留 Maven 缓存卷 `flux-3xui-m2` 加速后续验证。
- 后续：提交推送到 `origin/main` 和 `origin/future`，再确认 GitHub Actions、Pages 和 GHCR 镜像成果。

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

### Runtime Provider Action Catalog

- 完成：新增 Runtime Provider Action Catalog，把 `agent-maintenance` 动作的 label、category、danger、stateSync 等元数据收回 Runtime Provider 层，主控 UI、后端校验和 Agent 维护任务入口共用同一份动作契约。
- 修改：
  - 新增 `RuntimeProviderAction`，`RuntimeProviderDescriptor` 暴露 `actionCatalog`。
  - `RuntimeProviderService` 注册 XUI、Snell、Forward、Certificate、Firewall 的维护动作，并提供 `listAgentMaintenanceActions()` / `isAllowedAgentMaintenanceAction()`。
  - `DeployTaskServiceImpl.validateDeployTask` 改为复用 catalog 校验 `agent-maintenance`，不再维护散落字符串白名单。
  - `vite-frontend/src/pages/orchestrator.tsx` 增加 fallback catalog；State Sync 行动作和服务器卡片 Agent 按钮从 Runtime Provider action catalog 派生。
  - README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT 补充 Action Catalog 说明。
- 验证：
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - Docker Maven `RuntimeProviderServiceTest,DeployTaskServiceImplTest` 通过，16 个测试全部成功。
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- 清理：Docker Maven 容器 `flux-action-catalog-test` 使用 `--rm`，已结束无残留；agent mock 临时服务随脚本结束；本阶段未启动长期 dev server。
- 后续：提交并推送到 `origin/main` 和 `origin/future`，再检查 GitHub Actions 与 GHCR 镜像状态。

### Action Catalog Remote Verification

- 完成：确认 `bfff02e Add runtime provider action catalog` 已同步到 `origin/main` 和 `origin/future`，并完成远端 CI、Docker Images、Pages 与 GHCR 镜像验证。
- 验证：
  - `origin/main` 和 `origin/future` 均指向 `bfff02e03dc9d3c07a352df9f2982a0ccd7655ec`。
  - main Docker Images run `26424999510` 成功，main CI run `26424999514` 成功，main Pages deployment 成功。
  - future Docker Images run `26425008996` 成功，future CI run `26425009019` 成功。
  - GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 可读取，index digest 为 `sha256:007b640226dc97b977f15f749a47d8af4db09262290d4cfe9aa16a6d78fb5668`，linux/amd64 digest 为 `sha256:6c8055292c50e113d9eb5b47d2fb4150c49af22f973aa97f29fd8dfbaec9aafe`。
- 清理：本阶段只使用 `gh` 和 Docker manifest/imagetools 读取远端状态，未启动本地服务、未占用端口、未创建容器。
- 后续：收口默认单端口主控契约，避免旧分离容器或可选维护端口影响正式安装体验。

### Master Single-Port Contract

- 完成：补强默认单端口主控契约，确保正式安装继续朝 `mysql + flux-master` 单体主控形态收口。
- 修改：
  - `install-master.sh` 安装/升级前会移除旧分离栈容器 `vite-frontend`、`springboot-backend`、`gost-phpmyadmin`，避免旧 `80/6365/8066` 映射残留。
  - `install-master.sh doctor` 增加旧分离容器提示，并给 Docker daemon 检查加超时，避免预检卡死。
  - 新增 `scripts/test-master-port-contract.sh`，验证默认 compose 文件只发布一个 `flux-master` 主控入口，并确认安装脚本保留端口迁移、防 phpMyAdmin 默认暴露和旧容器清理保护。
  - GitHub Actions CI 和 `scripts/release-check.sh` 接入 master port contract 测试。
  - README、中文 README、Operations、Release Notes 和 PROJECT_CONTEXT 补充单端口主控、旧容器迁移清理和验证命令说明。
- 验证：
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-master-port-contract.sh` 通过。
  - `bash scripts/install-master.sh doctor` 通过。
  - `bash scripts/test-compose-smoke.sh --build-local --dry-run` 通过。
  - `bash scripts/test-install-matrix.sh --image debian:12-slim` 通过。
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- 清理：本阶段未启动长期服务；Debian install-matrix Docker 容器使用 `--rm` 自动清理；未保留端口监听。
- 后续：提交并推送到 `origin/main` 和 `origin/future`，再确认 GitHub Actions 与 GHCR 镜像状态。

### Master Single-Port Remote Verification

- 完成：确认 `ca95d4b Tighten master single-port contract` 已同步到 `origin/main` 和 `origin/future`，并完成远端 CI、Pages、Docker Images 与 GHCR 镜像验证。
- 验证：
  - `origin/main` 和 `origin/future` 均指向 `ca95d4b35e31e47d4ddd2b4caf93962e9a36aceb`。
  - main CI run `26425570607` 成功，main Pages deployment 成功。
  - future CI run `26425570585` 成功。
  - 手动触发 main Docker Images run `26425624672` 成功，手动触发 future Docker Images run `26425624679` 成功。
  - GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 可读取，index digest 为 `sha256:6ac01a8f03dbf17187d2c8a3ed69514dd79e841ffea30c6b5b753abbe092ba31`，linux/amd64 digest 为 `sha256:205667901f5dd3b59c765b56fca05dc4a52c948620e442a11de3ca0bc91bf240`。
- 清理：本阶段只使用 `gh` 和 Docker imagetools 读取远端状态，未启动本地服务、未占用端口、未创建容器。
- 后续：继续推进正式版缺口：真实 3x-ui 容器级 E2E、真实 VPS 矩阵、UI 错误/加载/空状态 polish、安全治理和 agent 自动升级。

### Real 3x-ui E2E Harness

- 完成：新增真实 3x-ui E2E 合同烟测入口，继续把 3x-ui/Xray Runtime 从 API fixture 推向可验证的真实端到端 gate。
- 修改：
  - 新增 `scripts/test-three-xui-e2e.sh`，支持真实 3x-ui endpoint/token 的状态、入站、Xray config 只读检查，以及显式写入模式下临时 VLESS inbound 创建、切换和删除。
  - 新增 `.github/workflows/three-xui-e2e.yml` 手动 workflow，并把可选真实 E2E gate 接入 CI 和 `scripts/release-check.sh`。
  - 增强 `scripts/three-xui-fixture.py` 的 form-urlencoded 和 `/panel/api/server/getConfigJson` 覆盖，让 `scripts/test-three-xui-fixture.sh` 能反打真实 E2E 脚本。
  - README、中文 README、Operations、Release Notes、GitHub Pages 和 PROJECT_CONTEXT 补充真实 E2E 的使用方式、skip 语义和剩余真机证明边界。
- 验证：
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-three-xui-e2e.sh` 在无 endpoint/token 时按设计 skip。
  - `bash scripts/test-three-xui-fixture.sh` 通过，并完成新 E2E 脚本对本地 fixture 的状态、入站、Xray config、临时 inbound 创建/切换/删除验证。
  - `bash scripts/release-check.sh` 通过，覆盖 agent mock、3x-ui fixture、可选真实 E2E skip、compose、master port contract、Docker Node 22 前端 build、compose dry-run 和 `git diff --check`。
- 清理：本地 3x-ui fixture 随脚本退出清理；临时 inbound 已删除；Docker Node 22 验证容器使用 `--rm`；未保留本轮端口监听。
- 后续：提交推送到 `origin/main` 和 `origin/future`，确认 GitHub Actions、Pages 和 GHCR 镜像成果；配置真实 3x-ui secrets 后再跑手动 workflow。

### Real 3x-ui E2E Remote Verification

- 完成：确认 `f9691f4 Add real 3x-ui E2E contract gate` 已同步到 `origin/main` 和 `origin/future`，并完成远端 CI、Pages、Docker Images 与 GHCR 镜像验证。
- 验证：
  - `origin/main` 和 `origin/future` 均指向 `f9691f4f28063f09391687c087519f4a0ff17cc6`。
  - main CI run `26428766161` 成功，future CI run `26428766915` 成功，main Pages deployment run `26428765778` 成功。
  - 手动触发 main Docker Images run `26428778888` 成功，手动触发 future Docker Images run `26428778873` 成功。
  - GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 可读取，index digest 为 `sha256:e7519039788a6ba54ec31fb4cc3b46864c9b774412894566be582d46533e15a3`，linux/amd64 digest 为 `sha256:29fea0bd5ffa8c67ed505bdc13d9c01a782c6f72168a7db96e159ff58ea2ea69`。
- 清理：本阶段只使用 `gh` 和 Docker imagetools 读取远端状态并触发镜像 workflow，未启动本地服务、未占用端口、未创建持久容器。
- 后续：提交并推送这份远端验证记录，再触发/确认最终 GitHub Actions 与 GHCR 镜像成果。

### Agent Safe Upgrade Lifecycle

- 完成：补强 `agent-maintenance upgrade-agent`，让被控 Agent 升级进入可审计、可回滚的主控任务闭环。
- 修改：
  - `flux-agent.sh` 新增 `--version`，默认版本提升为 `flux-agent/0.3`。
  - 主控生成的升级脚本先下载到临时文件，执行非空检查和 `bash -n`，再计算 SHA-256、备份旧二进制、staged install、计划重启 agent 服务。
  - 升级结果写入结构化 `maintenance.upgrade`，包含 source URL、agent binary、backup path、previous/new version、checksum、syntax/install/restart 状态。
  - 主控任务卡新增 Agent 升级摘要面板，并补齐中英文文案。
  - README、中文 README、Operations、Release Notes、GitHub Pages 和 PROJECT_CONTEXT 已同步说明安全升级生命周期。
- 验证：
  - `bash -lc 'bash -n scripts/*.sh'` 通过。
  - `bash -lc 'sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - Docker Maven `RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 17 个测试成功。
  - `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
  - `bash scripts/release-check.sh` 通过。
- 清理：Agent mock 临时目录已清理；3x-ui fixture 临时 inbound 已删除；Docker Maven 和 Docker Node 验证容器均使用 `--rm`，未保留容器或端口监听。
- 后续：提交推送到 `origin/main` 和 `origin/future`，确认 GitHub Actions、Pages 和 GHCR 镜像成果。

### Xray Agent Execution And Firewall Runtime Ports

- 完成：把 Runtime Provider 继续从“可见/可审计”推进到“可执行”，补齐 Xray/3x-ui inbound 编排和 firewall runtime port open/close 的 Agent 执行闭环。
- 修改：
  - `DeployTaskServiceImpl.buildXrayAgentPayload` 不再只输出占位 payload，而是生成 Agent 可执行脚本，解析 3x-ui endpoint/base path/token，调用 inbound add/delete 或 restart Xray API，并通过 `FLUX_AGENT_RESULT_JSON` 回传 inbound metadata。
  - Xray agent 结果已做 token 脱敏：执行脚本可以使用 3x-ui API token，但回报 JSON 只包含 `tokenConfigured`，不保存 token 明文。
  - `RuntimeProviderService` 将 `open-runtime-ports` 和 `close-runtime-ports` 注册为 firewall provider action，并让 runtime-port 类维护动作解析到 `firewall`。
  - `agent-maintenance` 脚本新增 runtime port 解析和本机 firewall 执行逻辑，支持 `ufw`、active `firewalld` 和 `iptables`，执行后继续输出结构化诊断。
  - 后端测试新增生成脚本 `bash -n` 校验，避免 Java text block / shell 拼接错误。
  - README、中文 README、Operations、Release Notes、GitHub Pages 和 PROJECT_CONTEXT 已同步说明这两条执行能力。
- 验证：
  - Docker Maven clean test：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 19 个测试成功。
  - `bash -n scripts/*.sh` 通过。
  - `sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh` 通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - `bash scripts/test-three-xui-fixture.sh` 通过，完成 3x-ui fixture 状态、入站、Xray config、临时 inbound 创建/切换/删除。
  - `bash scripts/release-check.sh` 通过，覆盖 shell、agent mock、3x-ui fixture + E2E fixture 反打、可选真实 E2E skip、compose config、master port contract、Docker Node 22 前端 build、compose dry-run 和 `git diff --check`。
  - Agent 任务结果脱敏修正后，Docker Maven targeted test：`RuntimeProviderServiceTest` + `DeployTaskServiceImplTest` 共 20 个测试成功。
- 清理：Docker Maven 容器 `flux-runtime-provider-clean-test`、`flux-runtime-provider-ret-test` 和 `flux-runtime-provider-sanitize-test` 均使用 `--rm` 并已退出；release-check 使用的 Docker Node 22 容器、agent mock 和 3x-ui fixture 的临时目录、临时服务和临时 inbound 已清理；未保留本轮端口监听。
- 后续：提交推送到 `origin/main` 和 `origin/future`，确认 GitHub Actions、Pages 和 GHCR 镜像成果。

### Runtime Provider Agent Execution Remote Verification

- 完成：确认 `2e2a0e8 Complete runtime provider agent execution` 已同步到 `origin/main` 和 `origin/future`，并完成远端 CI、Pages、Docker Images 与 GHCR 镜像验证。
- 验证：
  - `origin/main` 和 `origin/future` 均指向 `2e2a0e8bc262a57b78bd1b9ff5223e1d78a4af83`。
  - main CI run `26434051689` 成功，main Docker Images run `26434051681` 成功，main Pages deployment run `26434051078` 成功。
  - future CI run `26434064343` 成功，future Docker Images run `26434064354` 成功。
  - GHCR `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 可读取，index digest 为 `sha256:4be0416f955d89153d9560fe14a2fce27d37f94be9ee460084a1507e7ab19a5e`，linux/amd64 digest 为 `sha256:4263b75e715d095a0e7af53de714bd143451b297afdd91e1a4a641edc08687d7`。
- 清理：本阶段只使用 `gh` 和 Docker imagetools 读取远端状态，未启动本地服务、未占用端口、未创建持久容器。
- 后续：继续推进正式版缺口，优先评估并落地可选 SQLite 主控运行模式。

### SQLite Master Mode And Task Safety

- 完成：把目标架构里的 `DB: MySQL / 后续可选 SQLite` 推进为可安装的 SQLite 主控模式，同时补强 agent claim、危险维护动作确认和 Runtime State 主控审计。
- 修改：
  - 新增 `docker-compose.sqlite.yml`、`application-sqlite.yml`、`schema-sqlite.sql` 和 `scripts/test-sqlite-schema.sh`。
  - `install-master.sh` 支持 `FLUX_DB_MODE=mysql|sqlite` / `--db mysql|sqlite`，SQLite 模式只启动 `flux-master`，不启动 MySQL/phpMyAdmin。
  - SQLite 备份保存为 `sqlite-data/`，恢复写回 `.env` 中的 `SQLITE_DATA_DIR`；旧 MySQL 备份缺少 `DB_MODE` 时按 `mysql` 兼容。
  - Agent claim 使用 `generated -> claimed` 条件更新，危险 `agent-maintenance` 动作要求 `dangerConfirmed=true` 和匹配的 `confirmAction`。
  - 保存 agent 回报时由 master 覆盖 Runtime Provider/Runtime State 审计字段，并重新计算 `status/statusSource`，避免被控端伪造 State Sync 状态。
  - 主控 UI 为危险动作增加确认，并在 State Sync 行展示资源类型/ID与危险标记。
- 验证：
  - `bash scripts/test-master-port-contract.sh` 通过。
  - `bash scripts/test-sqlite-schema.sh` 通过。
  - `bash -n scripts/*.sh` 通过。
  - `bash -lc 'sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh'` 通过。
  - `npm run build` 通过，仅有既有 Vite dynamic/static import chunk 提示。
  - Docker Maven targeted test `RuntimeProviderServiceTest,DeployTaskServiceImplTest` 通过：22 tests, 0 failures。
  - `bash scripts/release-check.sh` 通过，覆盖 shell、agent mock、SQLite schema、3x-ui fixture、可选真实 3x-ui E2E skip、compose config、master port contract、Docker Node 22 前端 build、MySQL/SQLite compose dry-run 和 `git diff --check`。
- 清理：Docker Maven 容器 `flux-task-safety-test` 使用 `--rm` 并已退出；release-check 使用的 Docker Node 22 容器、agent mock 和 3x-ui fixture 临时资源已清理；未保留本轮端口监听。
- 后续：提交推送到 `origin/main` 和 `origin/future`，确认 GitHub Actions、Pages 和 GHCR 镜像成果。
