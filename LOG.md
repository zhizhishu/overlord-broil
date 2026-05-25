# LOG.md

## 2026-05-25

### Project Agent Context Bootstrap

- 完成：按全局 Agent 协议为项目新增 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md` 和 `LOG.md`。
- 修改：将项目身份、读写边界、验证命令、运行架构、单端口策略、Snell/3x-ui 边界和后续接力入口写入项目根目录。
- 兼容：保留旧 `TASK_LOG.md` 作为历史档案，没有强制迁移或删除。
- 验证：`git diff --check` 曾通过；该阶段只新增项目上下文和接力文档，未改业务代码。
- 后续：新任务使用 `TASK.md` 维护当前接力，阶段完成后追加到 `LOG.md`。

### Flux Master Single-Image Architecture Start

- 完成：启动 P0/P1 单体主控改造，把当前任务接力切换到 `flux-master` 单体镜像、默认 Compose 和 GHCR 镜像成果。
- 修改：新增根级 `Dockerfile` 和 `.dockerignore`，准备将 Vite 前端嵌入 Spring Boot；新增 Spring Boot SPA 路由承载；默认 Compose 初步改为 `mysql + master`；旧分离 Compose 保留为 legacy。
- 验证：后续需要以当前 worktree 复跑脚本语法、compose config、Docker build/smoke 和 GitHub Actions。
- 后续：继续修改安装脚本、CI、文档并推送。

### Flux Master Single-Image Runtime Milestone

- 完成：将默认运行形态收敛为 `mysql + flux-master`，主控 Web UI 与 API 由同一个 Spring Boot 进程在 `5166` 提供。
- 修改：更新 `Dockerfile`、Compose、安装脚本、release 脚本、CI、Docker Images workflow、README、中文 README、Operations、Release Notes 和项目上下文文档。
- 验证记录：上一轮已通过 compose config、shell syntax、agent mock、3x-ui fixture、dry-run compose smoke 和真实 Docker smoke；真实 smoke 中 `flux-master` `/flow/test` 通过，`http://127.0.0.1:18080/` 返回 `200`，测试容器/网络/卷/端口已清理。
- 后续：本轮需复跑关键验证，以当前 worktree 为准；之后提交并推送 `origin/main` 和 `origin/future`，再检查 GitHub Actions 与 GHCR master 镜像。

### Flux Master Local Verification Before Push

- 完成：以当前 worktree 复跑关键验证，确认单镜像主控里程碑可以提交。
- 验证：
  - `git diff --check` 通过；只有 Windows LF/CRLF 提示。
  - `bash -n scripts/*.sh` 和 `sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh` 通过。
  - `docker compose config --quiet` 覆盖 `docker-compose.yml`、`docker-compose-v4.yml`、`docker-compose-v6.yml`、`docker-compose.legacy-v4.yml`、`docker-compose.legacy-v6.yml` 并通过。
  - `bash scripts/test-flux-agent-mock.sh` 通过。
  - `bash scripts/test-three-xui-fixture.sh` 通过。
  - `bash scripts/test-compose-smoke.sh --build-local --dry-run` 通过。
  - `bash scripts/test-compose-smoke.sh --build-local` 通过；本地构建 `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest`，启动 `mysql + master`，`flux-master` 内部 `/flow/test` 通过，公共入口 `http://127.0.0.1:18080/` 返回 `200`。
- 清理：Docker smoke 自动删除 `flux-master`、`gost-mysql`、`gost-network`、`mysql_data`、`master_logs`；已复查 `18080` 无监听。
- 后续：提交并推送 `origin/main` 和 `origin/future`，检查 GitHub Actions 与 GHCR manifest。
