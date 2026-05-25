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
