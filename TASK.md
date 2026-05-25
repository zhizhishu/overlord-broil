# TASK.md

## Handoff Summary

当前目标：
朝用户给出的 `flux-master` 单体主控架构推进，先完成并推送 P0/P1 里程碑：单镜像主控、默认 `mysql + flux-master` Compose、安装脚本切换、CI/GHCR 可见镜像成果。

已完成：
- 已确认父级 `C:\Users\echo\Downloads\claude` 只是存放根目录，不在父级写日志或计划。
- 已确认真实项目根目录为 `C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator`。
- 已建立并读取项目级 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`、`LOG.md`。
- 已新增根级 `Dockerfile`，用于构建 Vite 前端并嵌入 Spring Boot jar，形成 `flux-master` 单体镜像。
- 已新增 `.dockerignore`，减少单镜像构建上下文。
- 已让 Spring Boot 支持 `SERVER_PORT` 配置，并新增 SPA 路由承载。
- 已把默认 `docker-compose.yml`、`docker-compose-v4.yml`、`docker-compose-v6.yml` 收敛为 `mysql + master`。
- 已保留旧前后端分离方案为 `docker-compose.legacy-v4.yml` / `docker-compose.legacy-v6.yml`。
- 已更新安装脚本，使默认安装/升级下载单体 Compose，并以 `ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest` 为默认运行镜像。
- 已更新 CI、Docker Images workflow、release check、release bundle 和 compose smoke 测试，纳入 master 单镜像。
- 已更新 README、中文 README、Operations、Release Notes、PROJECT_CONTEXT 的架构、端口和使用说明。

下一步：
- 快速复核关键 diff，确认没有把旧前后端分离路径误设为默认。
- 运行关键本地验证：compose config、shell 语法、agent mock、3x-ui fixture、compose smoke。
- 检查并清理 Docker 容器、网络、卷和端口。
- 提交并推送到 `origin/main` 和 `origin/future`，不要推送 `upstream`。
- 检查 GitHub Actions 和 GHCR master 镜像 manifest；如果 workflow 仍在跑，记录 Actions URL 和当前状态。

关键文件：
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `docker-compose-v4.yml`
- `docker-compose-v6.yml`
- `docker-compose.legacy-v4.yml`
- `docker-compose.legacy-v6.yml`
- `scripts/install-master.sh`
- `scripts/test-compose-smoke.sh`
- `scripts/release-check.sh`
- `scripts/build-release-bundle.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/docker-image.yml`
- `springboot-backend/src/main/java/com/admin/controller/SpaController.java`
- `springboot-backend/src/main/java/com/admin/config/WebMvcConfig.java`
- `springboot-backend/src/main/resources/application.yml`
- `README.md`
- `README.zh-CN.md`
- `docs/OPERATIONS.md`
- `docs/RELEASE_NOTES.md`

验证状态：
- 本轮已通过 `git diff --check`，只有 Windows LF/CRLF 提示，无空白错误。
- 本轮已通过 `bash -n scripts/*.sh` 和 `sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh`。
- 本轮已通过默认、v4/v6、legacy v4/v6 Compose config 校验。
- 本轮已通过 `bash scripts/test-flux-agent-mock.sh`。
- 本轮已通过 `bash scripts/test-three-xui-fixture.sh`。
- 本轮已通过 `bash scripts/test-compose-smoke.sh --build-local --dry-run`。
- 本轮已通过 `bash scripts/test-compose-smoke.sh --build-local`：本地构建 `flux-master` 单镜像，启动 `mysql + master`，`/flow/test` 通过，`http://127.0.0.1:18080/` 返回 `200`。

风险/待确认：
- 这是朝目标架构推进的单镜像/默认运行里程碑，不等于 Runtime Provider 层、Task 引擎和 UI 全量融合都已经完成。
- 真实 VPS 矩阵和真实 3x-ui 容器级端到端仍是 `1.0` 前的主要缺口。
- Snell 当前是产品层统一、agent 执行的独立 runtime，不是原生塞进 Xray/3x-ui 内核。
- Docker Images workflow 只在 `main` 和 tag 推送公开 GHCR 镜像；`future` 主要用于同步未来分支状态。

资源清理：
- Docker smoke 已自动清理测试容器、网络和卷。
- 已复查无 `flux-master` / `gost-mysql` 测试容器残留。
- 已复查无 `mysql_data` / `master_logs` 测试卷残留。
- 已复查无 `gost-network` 测试网络残留。
- 已复查 `18080` 无监听。
- 不关闭不属于本任务的 Docker、浏览器、MCP Router 或用户手动服务。

最后更新：
2026-05-25

## Active Tasks

- [x] **Goal:** 建立项目级 Agent 边界和上下文文件。
- [x] **Goal:** P0/P1 单体主控镜像和默认 Compose 落地。
- [x] **Goal:** 安装脚本、CI、文档同步到单体架构。
- [ ] **Goal:** 提交、推送并确认 GitHub 镜像成果。

## Notes For Next Agent

- 不要在父级存放根目录创建日志、计划或报告。
- 修改代码前先读 `PROJECT_ID.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、`TASK.md`。
- 推送只面向 `origin`：`zhizhishu/flux-3xui-orchestrator`。
- 不要向 `upstream`：`zhizhishu/flux-panel` 推送或开 PR。
- 主控目标形态是 `flux-master` 单体镜像，默认公网入口是 `5166`。
- 被控 agent 使用 `http://MASTER_IP:5166` 作为 `FLUX_PANEL_URL`。
