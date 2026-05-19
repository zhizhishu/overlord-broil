# TASK_LOG

## 接力摘要

- 当前目标：完成 Snell agent 执行、结构化 3x-ui inbound 表单、远端流量同步入库和构建验证收口。
- 已完成：
  - 从 `zhizhishu/flux-panel` 创建新项目 `flux-panel-3xui-orchestrator`。
  - 将参考仓库 `MHSanaei/3x-ui` 与 `jinqians/snell.sh` 克隆到本地 `_references/`，仅作为本地参考，不推送。
  - 新建私有主仓库 `zhizhishu/flux-3xui-orchestrator`，并将 `origin` 指向该仓库。
  - 将原 `zhizhishu/flux-panel` 远端改名为 `upstream`，只作为来源参考；已删除误推的远端分支，没有创建 PR。
  - 后端新增主控服务器、协议模板、部署任务、Snell 非交互部署脚本生成相关实体、服务、控制器和数据库表结构。
  - 前端新增 `/orchestrator` 主控中心页面和侧边栏入口，保持 `flux-panel` 现有 UI 基调。
  - 新增 3x-ui 远端代理：Bearer API token 管理 `/panel/api/inbounds/*`、读取 Xray config、读取 outbounds、重启 Xray；账号密码 + CSRF 通道用于保存 `/panel/xray/update`。
  - 主控中心服务器卡片新增“测 3x-ui / 入站 / 入站操作 / 配置 / 出站 / 保存出站 / 重启 Xray”入口。
  - README 补齐数据库升级 SQL、3x-ui API token 配置、入站/出站使用步骤和本项目 API 列表。
  - 公开站点 `zhizhishu.github.io` 文案已同步为 3x-ui 出入站代理版本。
  - 补齐主项目 README。
  - 创建公开站点仓库 `zhizhishu/zhizhishu.github.io`，发布静态项目官网到 `https://zhizhishu.github.io/`。
  - 新增 `POST /api/v1/agent-task/claim` 与 `POST /api/v1/agent-task/report`，副控通过服务器 `apiToken` + `X-Agent-Token` 自动领取和回传部署任务。
  - 新增 `scripts/flux-agent.sh`，副控可轮询主控、落地任务脚本、执行 Snell/Xray 部署脚本并回传 stdout/stderr/exit code。
  - 主控中心 inbound 操作从纯 JSON 升级为结构化表单，覆盖 VLESS Reality、VMess WebSocket、Trojan TLS、Shadowsocks，并保留高级 JSON 兜底。
  - 新增 `three_xui_traffic_snapshot` 本地表及同步接口，可把 3x-ui inbound/client/outbound 流量快照写入本地数据库。
  - 前端补齐 `@heroui/theme` / `@heroui/system` 兼容版本、移除旧 legacy 插件并显式加入 Tailwind/PostCSS 所需 `jiti`。
  - 新增 GitHub Actions CI，分别验证后端 Maven package 和前端 npm build。
- 下一步：
  - 给 `scripts/flux-agent.sh` 补 systemd unit/install helper，方便远端常驻运行。
  - 增加定时流量同步任务，减少只能手动点“同步流量”的限制。
  - 增加 Reality key、端口、outbound tag 等协议级校验，降低 3x-ui payload 填错风险。
  - 为 Snell 二进制下载增加 checksum 校验和版本源锁定。
- 关键文件：
  - `springboot-backend/src/main/java/com/admin/controller/ControlServerController.java`
  - `springboot-backend/src/main/java/com/admin/controller/ProtocolProfileController.java`
  - `springboot-backend/src/main/java/com/admin/controller/DeployTaskController.java`
  - `springboot-backend/src/main/java/com/admin/controller/ThreeXuiController.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/SnellTemplateServiceImpl.java`
  - `springboot-backend/src/main/java/com/admin/service/impl/ThreeXuiServiceImpl.java`
  - `vite-frontend/src/pages/orchestrator.tsx`
  - `gost.sql`
  - `README.md`
- 站点文件：
  - `C:\Users\echo\Downloads\claude\zhizhishu.github.io\index.html`
  - `C:\Users\echo\Downloads\claude\zhizhishu.github.io\styles.css`
  - `C:\Users\echo\Downloads\claude\zhizhishu.github.io\assets\control-plane-preview.svg`
- 验证：
  - `git diff --check` 已通过。
  - 主项目和站点仓库均已推送，当前分支干净并跟踪各自 `origin/main`。
  - `https://zhizhishu.github.io/` 返回 `200`，页面标题为 `Flux 3x-ui Orchestrator`。
  - `bash -n scripts/flux-agent.sh` 通过。
  - 前端已用 Docker Node 20 验证：`npm install --legacy-peer-deps --no-audit --no-fund && npm run build` 通过。
  - 后端已用 Docker Maven 验证：`mvn -B -DskipTests package` 通过。
  - 本机仍没有原生 `java`、`mvn`、`mvnw`；本地 Windows `vite-frontend/node_modules` 曾被中断安装破坏，改用 Docker/CI 作为干净构建基线。
- 风险/待确认：
  - 主仓库保持私有；由于当前 GitHub plan 不支持私有仓库 Pages，官网使用独立公开仓库 `zhizhishu.github.io`。
  - Snell 现在已经可通过副控 agent 自动领取和执行任务，但常驻服务、重试/退避、并发锁和 systemd 安装仍建议继续增强。
  - 3x-ui 各版本 API 可能有差异，本轮按本地 `_references/3x-ui` 的实际路由实现兼容代理，并把风险写进使用说明。

## 迭代计划

1. 确认三套源码的技术栈、入口和可复用能力边界。
2. 在 `flux-panel` 后端新增主控/副控服务器与协议部署任务的数据模型和 API 骨架。
3. 在前端新增服务器、协议、部署任务的管理入口，保持 `flux-panel` 现有 UI 风格。
4. 提取 Snell 安装脚本中的核心参数，形成可被主控下发的部署脚本模板。
5. 做最小静态验证，并准备 Git 分支与推送。
6. 将项目迁移并推送到用户自己的新仓库 `zhizhishu/flux-3xui-orchestrator`。
7. 为项目创建公开 `github.io` 站点，并验证线上访问。
8. 修复项目任务日志编码，补齐 GitHub Pages 发布记录。
9. 补齐 3x-ui 真实出入站管理代理、前端使用入口、文档和验证记录。

## 任务清单

- [x] ~~**目标:** 完成源码勘察、融合范围确认和第一版可执行拆分计划~~ (创建于: 2026-05-18 22:03:49 | **完成于: 2026-05-18 22:07:56**)
- [x] ~~**目标:** 新增主控服务器、协议模板、部署任务与 Snell 安装脚本生成的后端 API 骨架~~ (创建于: 2026-05-18 22:07:56 | **完成于: 2026-05-18 22:44:43**)
- [x] ~~**目标:** 完成 Git 提交并推送到 GitHub 分支~~ (创建于: 2026-05-18 22:44:43 | **完成于: 2026-05-18 22:46:53**)
- [x] ~~**目标:** 撤回误推的远端分支并删除 PR 提示记录~~ (创建于: 2026-05-18 23:24:30 | **完成于: 2026-05-18 23:24:30**)
- [x] ~~**目标:** 创建自有仓库 `zhizhishu/flux-3xui-orchestrator`，补充 README，并推送当前项目~~ (创建于: 2026-05-18 23:29:20 | **完成于: 2026-05-18 23:34:10**)
- [x] ~~**目标:** 新增 GitHub Pages 项目官网并发布到 `github.io`~~ (创建于: 2026-05-18 23:37:48 | **完成于: 2026-05-18 23:49:41**)
- [x] ~~**目标:** 修复 `TASK_LOG.md` 编码并补齐 GitHub Pages 发布接力记录~~ (创建于: 2026-05-18 23:53:08 | **完成于: 2026-05-18 23:54:21**)
- [x] ~~**目标:** 补齐 3x-ui 面板连接、inbound/outbound 管理代理和使用说明~~ (创建于: 2026-05-19 00:07:55 | **完成于: 2026-05-19 00:42:56**)
- [x] ~~**目标:** 完成 Snell agent 执行、结构化 inbound 表单、远端流量同步和构建验证收口~~ (创建于: 2026-05-19 02:32:57 | **完成于: 2026-05-19 04:39:18**)

## 推送记录

- 已撤回误推的远端分支：`origin/codex/3xui-orchestrator-snell`
- 说明：没有创建 PR；之前的链接只是 GitHub 在 `push` 后自动输出的“可创建 PR”提示。
- 新主仓库：`https://github.com/zhizhishu/flux-3xui-orchestrator`
- 当前主项目 `origin`：`https://github.com/zhizhishu/flux-3xui-orchestrator.git`
- 原 `flux-panel` 远端已改名为 `upstream`，仅作来源参考。
- 当前主项目分支：`main`
- GitHub Pages：`https://zhizhishu.github.io/`
- Pages 仓库：`https://github.com/zhizhishu/zhizhishu.github.io`
- 说明：主项目仍为私有仓库；因当前 GitHub plan 不支持私有仓库 Pages，官网发布在单独的公开静态站点仓库。
