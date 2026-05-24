# TASK_LOG

## 接力摘要

- 当前目标：主控面板已经从“节点创建/脚本生成”推进到“按被控服务器统一管理规则”，覆盖 3x-ui 出入站查看与调整入口、统一协议节点、Snell 节点、远端端口转发和规则总览。
- 正式可用硬化方向：优先补齐安装/升级/备份/恢复/卸载、agent 单机任务锁与重试退避、真实部署验证和 CI smoke test；随后推进敏感字段加密、Snell checksum、统一规则中心细节和监控告警。
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
  - 2026-05-20 10:26:10：完成正式可用硬化第一批。分布式 worker 复核安装脚本、README、Pages、CI 与 agent 脚本后，主线程补齐主控安装脚本 `upgrade/backup/restore/uninstall` 的可靠性校验、agent 任务锁/HTTP 重试/任务超时/结果元数据上报、agent systemd env 安全写入、可复用 agent mock 测试和 CI compose 校验。
  - 2026-05-20 21:03:36：完成产品化收尾第二批。分布式 worker 分别完成 Snell 供应链 checksum/版本锁、协议级 guardrails、CI compose smoke；主线程集成复查后补齐 Xray 本地字段校验、host-only/host:port 拆分、`gost-phpmyadmin` 资源保护和 `--build-local` smoke，避免本地/CI 依赖 GHCR 拉取权限。
  - 2026-05-20 22:26:22：完成 P1-P4 正式产品化。P1 主控中心新增统一规则中心、搜索/筛选/复制和运维入口；P2 新增 `monitor_alert` 后端模型/API、心跳/证书/服务/任务/流量告警和前端确认入口；P3 新增 3x-ui API fixture 与 CI 回归脚本；P4 补齐 `VERSION`、Release notes、Operations、README 发布与使用说明。验证通过：`bash -n scripts/*.sh`、`bash scripts/test-flux-agent-mock.sh`、`bash scripts/test-three-xui-fixture.sh`、`npm run build`、Docker Maven `mvn -B -DskipTests package`、`docker compose` v4/v6 config、`bash scripts/test-compose-smoke.sh --build-local --dry-run`、完整 `bash scripts/test-compose-smoke.sh --build-local`、`git diff --check`。
- 下一步：
  - 增加 Reality key、端口、outbound tag、Snell PSK/端口等协议级校验，降低 3x-ui/Snell payload 填错风险。
  - 为 Snell 二进制下载增加 checksum 校验和版本源锁定。
  - 后续可补 GitHub Actions 的完整 Docker compose smoke test fixture，进一步覆盖真实后端 API 与 agent 联动。
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
  - 本机前端已清理损坏的 `vite-frontend/node_modules`，重新执行 `npm install --legacy-peer-deps --no-audit --no-fund` 成功。
  - 本机前端 `npm run build` 通过，包含 `tsc` 与 Vite production build。
  - 前端已用 Docker Node 20 验证：`npm install --legacy-peer-deps --no-audit --no-fund && npm run build` 通过。
  - 后端已用 Docker Maven 验证：`mvn -B -DskipTests package` 通过。
  - 补齐一键编排任务：主控可多选服务器，按服务器生成 3x-ui 安装/配置、多协议节点、Snell 安装任务，副控 agent 自动领取执行。
  - 补齐 agent systemd 安装脚本 `scripts/install-flux-agent.sh`，agent 心跳会上报 CPU/内存/网卡流量、3x-ui/Xray/Snell 服务状态、证书状态。
  - 补齐服务器证书与服务状态字段、编排结果回写、每 5 分钟自动同步 3x-ui 流量任务。
  - 前端主控中心新增一键编排弹窗、多服务器选择、服务/证书/流量状态 chips。
  - README 已补齐数据库升级、agent 常驻安装、一键编排使用方式、自动流量同步和 API 列表。
  - 本机仍没有原生 `java`、`mvn`、`mvnw`；后端使用 Docker Maven 作为本地可复现构建基线。
  - 2026-05-19 06:14:15：`git diff --check` 通过；`bash -n scripts/flux-agent.sh scripts/install-flux-agent.sh` 通过；`vite-frontend npm run build` 通过；Docker Maven 后端构建容器退出码 `0`，产出 `springboot-backend/target/admin-0.0.1-SNAPSHOT.jar`。
  - 2026-05-19 07:12:45：本地 Docker 烟测发现并修复 `/api/v1/agent-task/**` 被 JWT 拦截的问题；修复后通过临时 MySQL + 后端容器验证登录、创建服务器、生成一键编排任务、agent claim、agent report、heartbeat、服务器元数据回写。
  - 2026-05-19 07:12:45：实际运行 `scripts/flux-agent.sh --once` 于 `node:20-bookworm` 临时容器，成功领取安全任务、执行脚本、解析 `FLUX_AGENT_RESULT_JSON`、回传 succeeded，并把服务器 3x-ui/证书/服务状态更新到临时数据库。
  - 2026-05-19 08:12:21：新增 `protocol_node` 统一协议节点层、后端 API、Snell 节点级 agent/systemd 任务、3x-ui inbound 同步入库、前端协议节点管理区和 README/官网说明；`npm run build` 与 Docker Maven 后端构建均通过。
  - 2026-05-19 10:17:38：新增 `server_forward_rule` 远端端口转发表、后端 API、agent systemd+socat 执行脚本、主控中心“新增转发/远端端口转发/规则总览”入口；规则总览会聚合本地协议节点、本地远端转发、实时 3x-ui inbound 和 3x-ui outbound。
  - 2026-05-19 10:17:38：修复 MySQL 8 默认认证下 JDBC 连接缺少 `allowPublicKeyRetrieval=true` 的问题。
  - 2026-05-19 10:17:38：Docker 烟测通过：临时 MySQL + 后端容器完成登录、创建被控服务器、创建远端转发、agent claim、agent report、`server_forward_rule` 状态回写为 `active`、`server-rule/overview` 返回远端转发规则；本轮临时容器和 network 已清理。
  - 2026-05-19 23:24:41：新增 GitHub Actions 镜像构建工作流，后端和前端镜像已通过 `Docker Images` workflow 构建并推送到 GHCR；compose 镜像地址已切换到 `ghcr.io/zhizhishu/flux-3xui-orchestrator-*`。
  - 2026-05-20 03:57:59：完成本地 Docker compose 全栈烟测，前端 `http://localhost:18080/` 返回 `200`，后端 `/flow/test` 返回 `test`；创建被控服务器、一键编排任务、agent claim/report、服务器状态回写均通过。烟测中修复 MySQL 首次初始化时 socket healthcheck 过早放行后端的问题，改为 TCP 账号 healthcheck；测试容器、卷、网络和端口已清理。
  - 2026-05-20 10:26:10：本轮硬化验证通过：`bash -n scripts/*.sh`、`bash scripts/test-flux-agent-mock.sh`、`docker compose -f docker-compose-v4.yml config --quiet`、`docker compose -f docker-compose-v6.yml config --quiet`、`vite-frontend npm run build`、Docker Maven `mvn -B -DskipTests package`、`git diff --check` 均通过；agent mock 覆盖 succeeded 与 timeout 两条路径，timeout 会回传 `exitCode=124` 与 `timedOut=true`。
  - 2026-05-20 21:03:36：产品化收尾第二批验证通过：`bash -n scripts/*.sh`、`bash scripts/test-flux-agent-mock.sh`、`bash scripts/test-compose-smoke.sh --build-local --dry-run`、`bash scripts/test-compose-smoke.sh --compose-file docker-compose-v6.yml --dry-run`、`npm run build`、Docker Maven `mvn -B -DskipTests package`、`git diff --check` 和本地 Docker `bash scripts/test-compose-smoke.sh --build-local` 全栈烟测均通过。完整 smoke 从当前源码构建 backend/frontend 镜像，启动 MySQL/后端/前端，验证 `/flow/test` 与前端首页 `200`，结束后已清理容器、卷、网络、临时 Maven cache volume 和本地测试镜像。
- 风险/待确认：
  - 主仓库保持私有；由于当前 GitHub plan 不支持私有仓库 Pages，官网使用独立公开仓库 `zhizhishu.github.io`。
  - Snell 现在已经可通过副控 agent 自动领取和执行任务，且已提供 systemd 常驻安装脚本；本轮已完成 Snell 下载来源、版本和 sha256 checksum 锁定，安装脚本下载后先校验再落地。
  - 3x-ui 各版本 API 可能有差异，本轮按本地 `_references/3x-ui` 的实际路由实现兼容代理，并把风险写进使用说明。

## 本轮执行计划（创建于: 2026-05-19 05:47:16）

1. 补齐后端一键编排任务：安装/配置 3x-ui、创建 VLESS Reality/VMess WS/Trojan TLS/Shadowsocks、安装 Snell，并把执行结果回写服务器记录。
2. 补齐证书、Xray、Snell、agent、流量和错误状态字段，让服务器卡片能显示统一运维状态。
3. 增加定时流量同步任务，主控可自动拉取多服务器 3x-ui 流量快照。
4. 补齐前端一键编排弹窗和多服务器状态视图，让用户从主控页面直接完成选择服务器、配置参数、生成任务。
5. 补齐 agent systemd 安装说明、README 使用路径和 Docker 构建验证记录。

## 本轮正式可用硬化计划（创建于: 2026-05-20 09:39:35）

1. 记录 P0/P1/P2/P3 产品化路线，明确正式可用的剩余风险与优先级。
2. 脚本运维面：增强主控安装脚本的升级、备份、恢复、卸载能力，并同步 README 与 Pages 使用说明。
3. agent 可靠性面：增加单机任务锁、任务执行超时、失败重试/退避和更清晰的错误上报。
4. CI/验证面：补 compose 配置验证、脚本语法验证和可复用本地 smoke test 入口，继续保留 Docker 构建验证。
5. 收口：本地构建/脚本/compose 验证通过后提交推送，并观察 GitHub Actions。

## 本轮产品化收尾计划（创建于: 2026-05-20 20:04:50）

1. P0 Snell 供应链收口：锁定 Snell 下载版本、来源和 sha256 checksum；agent 任务脚本下载后先校验再安装，失败时明确回报。
2. P1 协议级校验：在后端生成任务/创建节点/创建远端转发前校验端口范围、端口重复、Reality 关键字段、Snell PSK、outbound tag 和转发目标，减少错误配置下发。
3. P2 CI 完整 smoke：新增 GitHub Actions 可复用 compose smoke 入口，自动启动临时主控栈并验证基础 API/agent mock 链路，结束后清理容器和卷。
4. P3 Pages 兼容维护：处理 GitHub Pages Node 20 deprecation 提示，补 workflow 环境变量或 action 升级说明，避免后续 runner 默认切换时突然失败。
5. 分布式执行方式：主线程维护 `TASK_LOG.md`、集成 diff 和最终验证；worker 分别负责 Snell/协议校验/CI 文档等不重叠写入范围；所有结果由主线程汇总提交推送。

## 本轮 P1-P4 正式产品化计划（创建于: 2026-05-20 21:43:19）

1. P1 规则中心增强：在主控中心把 3x-ui inbound/outbound、Snell、远端转发和本地规则汇总成更清晰的统一规则视图，支持筛选、刷新、复制关键配置、快速定位状态和任务入口。
2. P2 监控告警：新增服务端告警模型/API，基于 agent 心跳、证书、Xray/Snell/3x-ui 服务状态、任务失败和流量异常生成站内告警，供主控统一查看与确认。
3. P3 真实 3x-ui 回归夹具：新增可复用的 3x-ui API mock/fixture 与脚本，覆盖连接测试、inbound 列表/新增/更新/删除、outbound/config/traffic/restart 等代理链路，并纳入 CI。
4. P4 发布体验：补齐版本/Release notes/安装与验证说明，把当前正式可用能力、CI smoke、镜像与安装路径写清楚，方便公开仓库使用和后续发版。
5. 分布式执行方式：主线程维护 `TASK_LOG.md`、集成 diff、跑完整验证和推送；worker 分别负责 P1 前端、P2 后端告警、P3 测试夹具、P4 文档发版，写入范围互斥。

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

- [x] ~~**目标:** 更新 README 参考来源与致谢说明，明确本项目独立性和参考仓库贡献~~ (创建于: 2026-05-20 22:45:35 | **完成于: 2026-05-20 22:46:22**)
- [x] ~~**目标:** 分布式完成 P1-P4 正式产品化：规则中心、监控告警、3x-ui 回归夹具和发布体验~~ (创建于: 2026-05-20 21:43:19 | **完成于: 2026-05-20 22:26:22**)
- [x] ~~**目标:** 完成产品化收尾第二批：Snell checksum、协议级校验、CI smoke 和 Pages 兼容维护~~ (创建于: 2026-05-20 20:04:50 | **完成于: 2026-05-20 21:03:36**)
- [x] ~~**目标:** 完成正式可用硬化第一批：安装运维能力、agent 任务可靠性和验证闭环~~ (创建于: 2026-05-20 09:39:35 | **完成于: 2026-05-20 10:26:10**)
- [x] ~~**目标:** 清理本地换行脏差异并完成架构与可用性复核测试~~ (创建于: 2026-05-20 02:58:42 | **完成于: 2026-05-20 03:57:59**)
- [x] ~~**目标:** 修复公开仓库 GitHub Pages 配置并更新 README 为公开仓库安装说明~~ (创建于: 2026-05-20 01:11:46 | **完成于: 2026-05-20 01:16:58**)
- [x] ~~**目标:** 补齐主控一键部署脚本和被控端一条命令安装 agent 的使用入口~~ (创建于: 2026-05-19 23:34:25 | **完成于: 2026-05-19 23:43:32**)
- [x] ~~**目标:** 新增 GitHub Actions 镜像构建与 GHCR 推送，覆盖后端和前端 Docker 镜像~~ (创建于: 2026-05-19 23:15:58 | **完成于: 2026-05-19 23:24:41**)
- [x] ~~**目标:** 落实主控面板统一管理所有被控服务器，覆盖远端端口转发、3x-ui 出入站规则查看与规则调整入口~~ (创建于: 2026-05-19 08:21:27 | **完成于: 2026-05-19 10:17:38**)
- [x] ~~**目标:** 将 Snell 提升为统一协议节点能力，和 3x-ui/Xray 节点一起完成创建、删除、同步与可视化管理~~ (创建于: 2026-05-19 07:32:51 | **完成于: 2026-05-19 08:12:21**)
- [x] ~~**目标:** 完成源码勘察、融合范围确认和第一版可执行拆分计划~~ (创建于: 2026-05-18 22:03:49 | **完成于: 2026-05-18 22:07:56**)
- [x] ~~**目标:** 新增主控服务器、协议模板、部署任务与 Snell 安装脚本生成的后端 API 骨架~~ (创建于: 2026-05-18 22:07:56 | **完成于: 2026-05-18 22:44:43**)
- [x] ~~**目标:** 完成 Git 提交并推送到 GitHub 分支~~ (创建于: 2026-05-18 22:44:43 | **完成于: 2026-05-18 22:46:53**)
- [x] ~~**目标:** 撤回误推的远端分支并删除 PR 提示记录~~ (创建于: 2026-05-18 23:24:30 | **完成于: 2026-05-18 23:24:30**)
- [x] ~~**目标:** 创建自有仓库 `zhizhishu/flux-3xui-orchestrator`，补充 README，并推送当前项目~~ (创建于: 2026-05-18 23:29:20 | **完成于: 2026-05-18 23:34:10**)
- [x] ~~**目标:** 新增 GitHub Pages 项目官网并发布到 `github.io`~~ (创建于: 2026-05-18 23:37:48 | **完成于: 2026-05-18 23:49:41**)
- [x] ~~**目标:** 修复 `TASK_LOG.md` 编码并补齐 GitHub Pages 发布接力记录~~ (创建于: 2026-05-18 23:53:08 | **完成于: 2026-05-18 23:54:21**)
- [x] ~~**目标:** 补齐 3x-ui 面板连接、inbound/outbound 管理代理和使用说明~~ (创建于: 2026-05-19 00:07:55 | **完成于: 2026-05-19 00:42:56**)
- [x] ~~**目标:** 完成 Snell agent 执行、结构化 inbound 表单、远端流量同步和构建验证收口~~ (创建于: 2026-05-19 02:32:57 | **完成于: 2026-05-19 04:39:18**)
- [x] ~~**目标:** 完成主控一键安装/配置 3x-ui、多协议节点、证书状态与多服务器统一运维闭环~~ (创建于: 2026-05-19 05:31:55 | **完成于: 2026-05-19 06:14:15**)
- [x] ~~**目标:** 用本地 Docker 完成主控 API 生成一键编排任务与 agent claim/report/heartbeat 闭环烟测并清理资源~~ (创建于: 2026-05-19 06:26:54 | **完成于: 2026-05-19 07:12:45**)

## 推送记录

- 已撤回误推的远端分支：`origin/codex/3xui-orchestrator-snell`
- 说明：没有创建 PR；之前的链接只是 GitHub 在 `push` 后自动输出的“可创建 PR”提示。
- 新主仓库：`https://github.com/zhizhishu/flux-3xui-orchestrator`
- 当前主项目 `origin`：`https://github.com/zhizhishu/flux-3xui-orchestrator.git`
- 原 `flux-panel` 远端已改名为 `upstream`，仅作来源参考。
- 当前主项目分支：`main`
- 2026-05-19 04:44:59：本轮产品化提交已推送到主项目 `origin/main`，commit `2e57363168596a5bfc42108b2bdf23bc2552a771`。
- GitHub Pages：`https://zhizhishu.github.io/`
- Pages 仓库：`https://github.com/zhizhishu/zhizhishu.github.io`
- 2026-05-19 04:44:59：官网状态文案已推送到 Pages 仓库 `origin/main`，commit `452442dedee181746c19ffc6cba027ed2cbfbde4`；线上返回 `200`，页面包含 Snell agent 自动执行与远端流量同步入库状态。
- 说明：主项目仍为私有仓库；因当前 GitHub plan 不支持私有仓库 Pages，官网发布在单独的公开静态站点仓库。
- 2026-05-19 08:16:06：统一协议节点层已推送到主仓库 `origin/main`，commit `79f8cfd`；GitHub Actions CI run `26106480537` 通过。官网同步说明已推送到 Pages 仓库，commit `660d6ca`；`https://zhizhishu.github.io/` 返回 `200`。
- 2026-05-19 10:22:58：远端端口转发、规则总览、MySQL 8 JDBC 兼容修复已推送到主仓库 `origin/main`，commit `f20926c7629dab33beb28a34819a48b0cc853148`；GitHub Actions CI run `26113491240` 通过。官网同步说明已推送到 Pages 仓库，commit `81d6d36193138855ce5368e84185035d9190c9c1`；`https://zhizhishu.github.io/` 返回 `200` 且包含“远端端口转发与规则总览”。
- 2026-05-19 23:24:41：GHCR 镜像构建工作流已推送到主仓库 `origin/main`，commit `32e46cd80d2ababf92963e8266f269254f2313ce`；GitHub Actions `Docker Images` run `26145172883` 通过，`CI` run `26145172938` 通过。
- 2026-05-20 10:26:10：正式可用硬化第一批主体提交为 `b044d9a`；内容包括主控安装脚本 day-2 运维能力、agent 可靠性增强、可复用 agent mock 测试、CI compose 校验、README/Pages 使用说明。

## 本轮分布式硬化计划（创建于: 2026-05-21 01:48:00）
1. 后端主控自控安全模式：以 `control_server.role=master` 为主控自身标识，集中拦截会占用主控保护端口或破坏主控栈的编排、协议节点和远端转发操作。
2. 后端凭据加密：新增兼容旧明文数据的 3x-ui/API token 加密读写能力，运行时自动解密，接口输出继续只返回掩码。
3. 3x-ui 回归测试增强：让 fixture 更贴近真实鉴权/响应形态，并补 CI 可复用 smoke 入口。
4. 前端运维辅助：在 Flux 风格主控页里补 Reality shortId、Snell PSK、UUID、outbound tag 等生成/选择辅助，并提示 master 服务器风险。
5. 验证与发布：运行脚本、前端构建、Docker Maven 构建、compose 配置/smoke、`git diff --check`，清理本轮启动资源后提交并推送 `origin/main`，观察 GitHub Actions。

## 本轮任务清单

- [x] ~~**目标:** 推进到可上架正式版：补齐发布清单、修正正式版文档口径、处理 Actions Node 24 兼容提示、完成完整验证并推送发布就绪提交~~ (创建于: 2026-05-21 11:19:29 | **完成于: 2026-05-21 13:08:00**)
- [x] ~~**目标:** 分布式完成主控自控安全、凭据加密、3x-ui 回归增强和前端生成辅助，并完成验证、提交、推送~~ (创建于: 2026-05-21 01:48:00 | **完成于: 2026-05-21 02:54:48**)

## 本轮正式上架硬化计划（创建于: 2026-05-21 12:13:22）
1. 安装兼容性：增强主控与被控脚本在 Debian/Ubuntu、Alpine、Rocky Linux、Oracle Linux 上的包管理器、Docker/Compose、systemd/OpenRC 适配与失败提示。
2. 主控/被控可靠性：补安装前端口占用、环境变量、服务状态、日志与卸载/升级路径检查，降低一键安装失败和误操作风险。
3. Flux 风格 UI：继续把主控中心打磨成密集、清晰、运维控制台式布局，重点优化服务器卡片操作分组、状态可读性和上架观感。
4. README/运维文档：补正式版安装矩阵、端口占用、防火墙建议、Agent 服务管理和常见排障。
5. 验证与发布：运行脚本语法、agent mock、3x-ui fixture、前端构建、Docker Maven、compose/smoke、diff 检查，清理资源后提交推送并观察 GitHub Actions。

## 本轮正式上架任务清单

- [x] ~~**目标:** 完成正式上架硬化：Linux 安装适配、Flux UI 打磨、主控/被控可靠性、README/运维文档、完整验证和 GitHub 推送~~ (创建于: 2026-05-21 12:13:22 | **完成于: 2026-05-21 13:08:00**)

### 2026-05-21 13:02:34 进度记录

- 已完成实现与本地验证：Debian/Ubuntu、Rocky/Oracle Linux、Alpine/OpenRC 分层支持矩阵；新增 POSIX bootstrap 安装器；agent/OpenRC、Snell/OpenRC、远端转发 OpenRC 支持；3x-ui 完整安装编排增加 systemd preflight；主控页服务器卡片操作分组已按 Flux 运维控制台方向打磨；README、Operations、Release Notes、项目 docs 官网和独立 `zhizhishu.github.io` 官网已同步正式版使用说明。
- 本地已通过：`bash -n scripts/*.sh`、`sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh`、`bash scripts/test-flux-agent-mock.sh`、`bash scripts/test-three-xui-fixture.sh`、`docker compose -f docker-compose-v4.yml config --quiet`、`docker compose -f docker-compose-v6.yml config --quiet`、`vite-frontend npm run build`、`git diff --check`。
- 本机 Docker Desktop engine 当前对 `docker run` / `docker ps` 返回 500，导致 Docker Maven 和完整 compose smoke 无法在本机继续跑；推送后由 GitHub Actions 的 backend、scripts compose smoke 和 Docker Images workflow 做最终验证。

### 2026-05-21 13:08:00 完成记录

- 主项目已推送 `origin/main`：`5a3d755`，提交信息 `Prepare 0.5.0 production release`。
- 官网仓库已推送 `origin/main`：`f8c2fea`，提交信息 `Update Flux 3x-ui Orchestrator site for 0.5.0`。
- GitHub Actions 验证通过：主项目 `CI` run `26250075134` 通过，覆盖 backend Maven、frontend build、脚本校验、agent mock、3x-ui fixture、compose config、dry-run compose smoke、完整 compose smoke；`Docker Images` run `26250075225` 通过，backend/frontend GHCR 镜像均构建并推送；主项目 Pages run `26250074383` 通过；官网 Pages run `26250155252` 通过。
- 本轮资源清理：未保留本轮启动的 dev server、测试 watcher 或浏览器页签；本机 Docker Desktop engine 自身仍异常返回 500，但本轮启动的挂起 docker CLI 已清理，未关闭 Docker Desktop/WSL 后台服务。

## 本轮 0.6.0 可靠性版计划（创建于: 2026-05-21 13:21:17）
1. 安装矩阵诊断：为主控和 agent 安装器增加非破坏性的 `doctor`/预检入口，覆盖 OS、包管理器、Docker/Compose、systemd/OpenRC、端口和关键环境变量提示。
2. Docker/CI 验证：新增可复用的多发行版 Docker 矩阵脚本，在 Debian、Ubuntu、Alpine、Rocky Linux、Oracle Linux 容器内执行安装器预检和 bootstrap 语法检查；本机 Docker 不可用时由 GitHub Actions 跑完整矩阵。
3. 运维闭环增强：补 agent 健康检查、远端日志/状态诊断任务和更清晰的失败诊断，减少用户不知道怎么修的情况。
4. 3x-ui/Snell/证书边界：继续强化真实 3x-ui API fixture、ACME HTTP/DNS/端口提示、Snell 产品层统一但运行层分离的说明。
5. Flux UI 打磨：优化主控中心的上架观感、状态空态、错误态、诊断入口和移动端/小屏布局。
6. 文档与发布：更新 README、Operations、Release Notes、官网，运行本地可用验证与 GitHub Actions，清理资源后提交并推送。

## 本轮 0.6.0 任务清单

- [x] ~~**目标:** 完成 0.6.0 可靠性版第一批：安装矩阵预检、Docker/CI 验证、agent 诊断闭环、Flux UI/文档打磨并推送~~ (创建于: 2026-05-21 13:21:17 | **完成于: 2026-05-22 05:26:11**)
- [x] ~~**目标:** 修复 0.6.0 install-matrix CI：RHEL curl-minimal 包冲突与 Alpine 容器端口预检误判~~ (创建于: 2026-05-22 05:19:10 | **完成于: 2026-05-22 05:26:11**)

### 2026-05-22 05:09:54 进度记录

- 已完成 0.6.0 第一批本地实现：主控/agent/agent runtime `doctor` 预检、Debian/Ubuntu/Alpine/Rocky/Oracle Linux Docker 安装矩阵脚本、CI install-matrix job、`release-check --full` 安装矩阵接入、agent 远程维护任务（诊断/日志/重启/升级）、主控中心服务器卡片 Agent 操作组、README/Operations/Release Notes/官网 0.6.0 文档口径。
- 已完成本地非 Docker 验证：`bash -n scripts/*.sh`、`sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh`、`bash scripts/test-flux-agent-mock.sh`、`bash scripts/test-three-xui-fixture.sh`、`scripts/flux-agent.sh --doctor`、`scripts/install-master.sh doctor`、`scripts/install-flux-agent.sh doctor`、`docker compose -f docker-compose-v4.yml config --quiet`、`docker compose -f docker-compose-v6.yml config --quiet`、`vite-frontend npm run build`、`git diff --check`。
- 本机限制：当前 Windows Docker Desktop Linux engine 对 `docker version/docker run` 仍返回 500，导致本地 Docker Maven、Docker Node release-check、完整 compose smoke 和 `scripts/test-install-matrix.sh` 不能可靠执行；未关闭 Docker Desktop/WSL 后台进程，等待推送后用 GitHub Actions 完成 Docker/Maven/矩阵验证。
- 下一步：提交并推送主仓库与 `zhizhishu.github.io` 官网仓库，观察 `CI`、`Docker Images`、Pages 等 GitHub Actions；若 install-matrix 或 Java 编译暴露问题，立即修复并二次推送。

### 2026-05-22 05:26:11 完成记录

- 主仓库已推送 `origin/main`：`c05cd5a`，提交信息 `Fix 0.6.0 install matrix diagnostics`。该提交修复了 RHEL/Rocky 系 `curl-minimal` 与 `curl` 包冲突，并为容器化 doctor 增加 `FLUX_DOCTOR_SKIP_PORT_CHECK=1`，避免 Alpine/CI 预检误判端口占用。
- GitHub Actions `CI` run `26253894837` 已通过：backend Maven、frontend build、scripts、agent mock、3x-ui fixture、compose config、dry-run compose smoke、完整 compose smoke、Debian/Ubuntu/Alpine/Rocky Linux/Oracle Linux install-matrix 全部成功。
- GitHub Actions `pages-build-deployment` run `26253893769` 已通过；上一轮 `Docker Images` run `26253407666` 已通过，backend/frontend GHCR 镜像已构建并推送。
- 本地复核通过：`bash -n scripts/*.sh`、`sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh`、`bash scripts/test-flux-agent-mock.sh`、`bash scripts/test-three-xui-fixture.sh`、带占位环境的 `scripts/flux-agent.sh --doctor`、`scripts/install-master.sh doctor`、`scripts/install-flux-agent.sh doctor`、v4/v6 compose config、`vite-frontend npm run build`、`git diff --check`。
- 本机 Docker Desktop Linux engine 仍对 `docker version` 返回 500；本轮未关闭 Docker Desktop/WSL 后台服务，完整 Docker/Maven/compose/矩阵验证以 GitHub Actions 结果为准。

## 2026-05-23 正式版展示与 future 分支计划

### 本轮计划（创建于: 2026-05-23 10:14:47）

1. 明确离正式版还差什么：把 0.6.0 已覆盖能力、仍缺的 1.0/商业级能力和下一步优先级写进 README。
2. 补充 Flux UI 展示材料：生成可提交的主控工作台截图资产，放到项目内 `docs/assets/`，README 直接展示。
3. 补 README 使用路径：保留一键安装、agent 安装、端口占用、主控/被控能力边界，并新增截图说明。
4. 本地验证：检查 Markdown/资产引用、前端构建、脚本语法和 diff。
5. 推送策略：不动上游，不开 PR；将本轮正式版展示材料推送到 `origin/future` 分支，供后续合并或发布使用。

- [x] ~~**目标:** 补齐正式版差距说明、Flux UI 截图资产、README 截图展示，并推送到 `future` 分支~~ (创建于: 2026-05-23 10:14:47 | **完成于: 2026-05-23 10:34:52**)

### 2026-05-23 10:34:52 进度记录

- README 已新增 `UI Preview` 截图区、`Formal Release Gap` 正式版差距说明和 `future` 分支 P0-P3 路线。
- 新增 `docs/assets/flux-orchestrator-screenshot.svg`，展示 Flux 风格主控工作台：服务器卡片、统一规则、3x-ui/Snell/Agent 操作和一键编排。
- 本地验证：`git diff --check` 通过；`bash -n scripts/*.sh` 通过；`bash -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh` 通过；`npm run build` 通过；SVG XML 解析通过。
- 环境限制：本机 Docker Desktop Linux engine 当前不可连接，本轮未跑 Docker compose/Maven 容器验证，后续以 GitHub Actions 或恢复 Docker 后再补完整 release gate。
- 2026-05-23 10:37:30 追加：发现 GitHub Actions 只监听 `main`，已补 `future` 分支 CI 触发，并让 Docker Images workflow 支持 `future` 分支镜像构建。
- 2026-05-23 10:46:47 追加：`future` 分支 Docker Images 前端镜像构建通过但 GHCR 推送 `frontend:future` 被拒绝；已调整为 `future` 只构建验证，只有 `main` 和 `v*` tag 推送 GHCR。
- 2026-05-23 10:50:49 追加：`future` 分支 GitHub Actions 已通过，`CI` run `26330713783` 和 `Docker Images` run `26330713785` 均为 success。

## 2026-05-23 中文文档与语言口径计划

### 本轮计划（创建于: 2026-05-23 22:16:14）

1. 复核 UI 语言现状：确认主控核心页面、导航和常用操作是否以中文为主。
2. 补中文 README：新增 `README.zh-CN.md`，覆盖项目定位、UI 截图、安装、端口、主控/被控使用、正式版差距、future 分支和镜像策略。
3. 补英文 README 入口：添加中文 README 链接和 UI 默认中文说明。
4. 验证与推送：运行 Markdown/链接/diff/前端构建检查，提交并推送 `origin/future`。

- [x] ~~**目标:** 补齐中文 README、UI 语言说明和 future/GHCR 策略解释，并推送到 `future` 分支~~ (创建于: 2026-05-23 22:16:14 | **完成于: 2026-05-23 22:19:38**)

### 2026-05-23 22:19:38 进度记录

- 新增 `README.zh-CN.md`，覆盖中文用户需要的项目定位、UI 默认中文、截图、安装、端口、主控/被控使用、Snell/3x-ui 边界、future/GHCR 策略和 1.0 差距。
- 英文 `README.md` 已新增中文说明入口、Chinese-first UI 说明，以及 `future` 只构建验证不推 GHCR 的发布策略说明。
- 本地验证：`git diff --check` 通过；中文 README 链接存在；`npm run build` 通过。
- 2026-05-23 22:23:33 追加：推送 `future` 后 GitHub Actions `CI` run `26352795372` 已通过，覆盖 backend、frontend、scripts、compose smoke 和安装矩阵。

## 2026-05-23 前端中英文切换实施计划

### 本轮计划（创建于: 2026-05-23 22:19:57）

1. 新增轻量 i18n 基础设施：语言类型、字典、Provider、hook、本地存储和 HTML `lang` 同步。
2. 新增语言切换按钮：放到桌面布局、H5 简化布局和公共 Navbar，保持 Flux 运维控制台的紧凑风格。
3. 优先覆盖核心运维界面：主控中心标题、统计卡片、规则中心、服务器卡片、主要操作按钮、关键弹窗标题和常用 toast。
4. 同步 README 与中文 README：把“未提供切换”的旧口径改为“已提供核心界面中英文切换，历史页面分批覆盖”。
5. 验证与发布：运行 `npm run build`、脚本语法和 `git diff --check`，提交并推送 `origin/future`，观察 GitHub Actions。

- [x] ~~**目标:** 新增前端中英文切换基础设施，覆盖主控核心页面与文档口径，并推送到 `future` 分支~~ (创建于: 2026-05-23 22:19:57 | **完成于: 2026-05-23 23:16:21**)

### 2026-05-23 23:16:21 进度记录

- 新增前端轻量 i18n 基础设施：`LanguageProvider`、`useLanguage`、`zh-CN/en-US` 类型、localStorage 语言持久化、HTML `lang` 同步和参数插值。
- 新增 `LanguageSwitch`，接入桌面主布局、H5 布局、H5 简化布局和公共 Navbar；HeroUI `I18nProvider` 已随当前语言切换。
- 主控中心核心链路已接入中英文：导航、服务器卡片、统一规则、监控告警、一键编排、部署任务、3x-ui 入站/出站配置、Snell 节点、远端转发、agent 诊断/日志/重启/升级、常用 toast 和脚本弹窗。
- README 与中文 README 已同步：说明当前默认中文、已提供核心界面 `zh-CN/en-US` 切换，旧 Flux 转发页面可继续按同一字典分批覆盖。
- 本地验证：`npm run build` 通过；`git diff --check` 通过；`bash -n scripts/*.sh` 通过；临时 Vite dev server `127.0.0.1:5173` HTTP 200 检查通过并已关闭。当前 PowerShell PATH 无 `sh` 命令，因此 `sh -n` bootstrap 复核无法在本机执行。
- 2026-05-23 23:29:50 追加：已推送 `origin/future` 提交 `c493d37`；GitHub Actions `CI` run `26353817391` 和 `Docker Images` run `26353817388` 均已通过。

## 2026-05-24 默认端口迁移计划

### 本轮计划（创建于: 2026-05-24 03:52:53）

1. 主控默认端口迁移：将前端公开端口从 `80` 改为 `5166`，后端 API / agent 回调继续保留 `6365`，避免破坏既有 agent 通信链路。
2. 被控 3x-ui 默认端口迁移：将一键编排里的 3x-ui 面板默认端口从 `54321` 改为 `5168`，同步前端表单、后端 DTO 和脚本兜底默认值。
3. phpMyAdmin 暴露策略收口：默认不暴露 phpMyAdmin 宿主机端口，只有显式设置 `FLUX_PHPMYADMIN_PORT` 或 `--phpmyadmin-port` 时才发布；安装输出和 doctor 需要明确显示状态。
4. 文档端口说明：README / 中文 README 清楚列出主控默认暴露端口、默认不暴露端口、被控按编排暴露端口和 ACME `80` 的边界。
5. 验证与推送：运行脚本语法、compose config、前端构建、`git diff --check`，提交并推送 `origin/future`，观察 GitHub Actions。

- [x] ~~**目标:** 完成主控 `5166`、被控 3x-ui `5168` 默认端口迁移，收口 phpMyAdmin 默认不暴露，并更新 README 后推送 `future` 分支~~ (创建于: 2026-05-24 03:52:53 | **完成于: 2026-05-24 04:41:22**)

### 2026-05-24 04:41:22 进度记录

- 主控前端默认公开端口已从 `80` 改为 `5166`；后端 API / agent 回调继续保留 `6365`。
- 一键编排里的被控 3x-ui 面板默认端口已从 `54321` 改为 `5168`，覆盖前端表单、后端 DTO 和脚本生成兜底值。
- phpMyAdmin 已改为默认不暴露宿主机端口；基础 compose 保留内部服务，安装脚本仅在 `PHPMYADMIN_PORT` 非空时生成 `docker-compose-phpmyadmin.yml` override 暴露端口。
- README、中文 README、Operations 和项目 docs 站点已同步说明默认暴露端口、默认不暴露端口、被控端口和 ACME HTTP `80` 的边界。
- 本地验证：`bash -n scripts/*.sh` 通过；`scripts/install-master.sh doctor` 显示 frontend=`5166`、backend=`6365`、phpmyadmin=`disabled`；v4/v6 compose config 通过；phpMyAdmin override config 可正确发布 `18066:80`；`npm run build` 通过；agent mock 与 3x-ui fixture 通过；`git diff --check` 通过。
- 本机 Docker Desktop Linux engine 当前不可连接，无法跑 Docker Maven 后端容器构建；后端 Java 编译交由 GitHub Actions 验证。
- 2026-05-24 04:54:56 追加：`origin/future` 最新提交 `18e8c6b` 的 GitHub Actions 已通过，`CI` run `26360283823` 与 `Docker Images` run `26360283821` 均为 success。

## 2026-05-24 Agent 运维闭环与正式版产品化计划

### 本轮长期计划（创建于: 2026-05-24 07:13:36）

1. Agent 运维闭环：补齐自动升级、卸载、任务失败重试、远端日志拉取、一键修复 3x-ui / Snell / Xray、安装失败自动诊断。
2. 证书和防火墙诊断：把 ACME、80 端口、DNS、云防火墙、端口占用、证书续期失败原因输出成用户能看懂的诊断项。
3. Flux UI 打磨：补新手首次配置向导、精致节点创建表单、统一状态/空状态/失败态、移动端适配、旧转发页面 i18n、减少 JSON 编辑。
4. 发布体验：固定版本号、changelog、一键升级脚本、回滚说明、推荐防火墙规则、GitHub Release 自动生成。
5. 验证与推送：每个切片跑本地可用测试，推送 `origin/future` 并观察 GitHub Actions。

- [x] ~~**目标:** 完成 Agent 运维闭环第一批：自动升级/卸载、任务失败重试、远端日志拉取、一键修复、安装/证书/防火墙诊断，并接入主控 UI 与文档~~ (创建于: 2026-05-24 07:13:36 | **完成于: 2026-05-24 10:12:47**)

### 2026-05-24 10:12:47 进度记录

- 后端新增失败/超时部署任务重试接口：`POST /api/v1/deploy-task/retry` 会复用原任务脚本、协议和动作创建新的 `generated` 任务，并在 `request_json` 记录原任务来源。
- Agent 维护动作扩展为诊断、日志、重启、升级、卸载、安装诊断、证书诊断、防火墙诊断、一键修复和分项修复 3x-ui/Xray/Snell；维护脚本会输出结构化 `FLUX_AGENT_RESULT_JSON`，便于主控回写服务状态。
- 主控 UI 已补 Agent 运维按钮、失败任务重试入口和中英文文案；README、中文 README、Operations、Release Notes 已同步说明重试语义、ACME/80/DNS/防火墙诊断和修复入口。
- 本地验证通过：Docker Maven `mvn -B -DskipTests package` 成功生成后端 jar；`vite-frontend npm run build` 通过；`git diff --check` 通过。
- 本轮环境限制：Windows Git Bash 当前无法创建 signal pipe / CreateFileMapping，WSL 返回 `E_ACCESSDENIED`，Docker API 后续检查返回 pipe permission denied；因此本轮收尾时无法重新跑 bash 脚本语法、agent mock 和 3x-ui fixture。该三项在本批改动过程中已跑通过一次，最终仍需推送后由 GitHub Actions 再确认。
- 2026-05-24 10:22:12 追加：已推送 `origin/future` 提交 `c89fe3c`；GitHub Actions `CI` run `26367725355` 已通过，覆盖 frontend、backend、shell scripts、agent mock、3x-ui fixture、compose config、dry-run/full compose smoke、Debian/Ubuntu/Alpine/Rocky Linux/Oracle Linux install matrix；`Docker Images` run `26367725330` 也已通过。

## 2026-05-24 Release 包与首次配置向导计划

### 本轮计划（创建于: 2026-05-24 10:37:26）

1. 发布包能力：新增 release bundle 脚本，打包安装脚本、compose、SQL、文档、版本信息和校验文件，供 GitHub Release 下载与离线审计。
2. GitHub Release 自动生成：新增 `v*` tag / 手动触发 workflow，先跑 release gate，再上传 bundle 并生成 release notes。
3. 主控 UI 首次配置向导：在 `/orchestrator` 增加 Flux 风格的上手路径，把主控端口、被控 agent、3x-ui、Snell、证书/防火墙和发布验证串起来。
4. 文档同步：README、中文 README、Operations、Release Notes 写清 release 包、tag 发布、一键升级/回滚与推荐防火墙规则。
5. 验证与推送：运行本地可用构建/脚本检查，推送 `origin/future` 并观察 GitHub Actions。

- [x] ~~**目标:** 完成 Release 包/自动发布第一批和主控首次配置向导，补齐文档后推送 `future` 分支~~ (创建于: 2026-05-24 10:37:26 | **完成于: 2026-05-24 11:40:20**)

### 2026-05-24 11:40:20 进度记录

- 新增 `scripts/build-release-bundle.sh`，可从当前 Git commit 生成 `dist/release/flux-3xui-orchestrator-<version>.tar.gz` 和 `.sha256`，包内包含 `RELEASE_MANIFEST.txt`、安装脚本、compose、SQL、README、中文 README、Operations 和 Release Notes；`.git`、`node_modules`、`target`、`dist`、`_references` 等本地/构建产物不进入发布包。
- 新增 `.github/workflows/release.yml`，支持 `v*` tag 和手动触发；workflow 会校验 `VERSION`，运行 `scripts/release-check.sh --full`，再用 clean-tree 要求构建 bundle 并上传到 GitHub Releases，`1.x` 之前自动标记 prerelease。
- 主控 `/orchestrator` 新增 Flux 风格首次配置向导，覆盖登记服务器、安装被控 agent、编排 3x-ui/Snell、同步规则与流量、发布前检查；对应文案已接入 `zh-CN/en-US` i18n。
- README、中文 README、Operations、Release Notes 和项目 docs 首页已同步 release 包、GitHub Release、首次向导和公网防火墙基线：主控前端 `5166/tcp`、后端/agent 回调 `6365/tcp`、ACME HTTP 仅按需开放 `80/tcp`，被控节点只开放实际编排端口。
- 本地验证：`vite-frontend npm run build` 通过；`git diff --check` 通过；Git Bash 显式路径下 `bash -n scripts/*.sh` 通过；release bundle 实际生成 tar.gz 和 sha256，抽查包内有 `RELEASE_MANIFEST.txt`、`README.zh-CN.md`、`docs/OPERATIONS.md`、`scripts/install-master.sh`，`sha256sum -c` 返回 OK。
- 环境限制：本机默认 `bash` 仍可能走 WSL 并返回 `E_ACCESSDENIED`，Git Bash 偶发 `couldn't create signal pipe, Win32 error 5`；本轮用提权 Git Bash 完成 release bundle 主路径验证，最终 Linux 侧仍以推送后的 GitHub Actions 为准。
