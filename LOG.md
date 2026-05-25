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
- 清理：
  - 慢速 bind-mount Maven 容器 `flux-runtime-provider-test-2` 已停止并清理。
  - 复制源码验证容器 `flux-backend-copy-verify` 使用 `--rm` 退出，无容器残留。
- 后续：提交并推送到 `origin/main` 和 `origin/future`，再检查 GitHub Actions 与 GHCR 镜像状态。
