# TASK_LOG

## 接力摘要

- 当前目标：基于 flux-panel 建立 3x-ui 能力融合与主控/副控多服务器节点编排的第一版项目骨架。
- 已完成：克隆 `zhizhishu/flux-panel` 为主项目；克隆 `MHSanaei/3x-ui` 与 `jinqians/snell.sh` 到 `_references/` 供本地参考；确认 flux-panel 为 Spring Boot + React/HeroUI，3x-ui 为 Go/Xray 面板，Snell 能力来自 Shell 安装脚本；新增主控服务器、协议模板、部署任务、Snell 非交互脚本生成、主控中心前端工作台。
- 下一步：在有 Java/Maven 与前端依赖完整环境后做端到端构建；下一轮可继续实现真正的 agent 执行器和 3x-ui 远端 inbound HTTP 客户端。
- 关键文件：`springboot-backend/`、`vite-frontend/`、`_references/3x-ui/`、`_references/snell.sh/`。
- 验证：`git diff --check` 通过；`mvn`、`java`、`mvnw` 当前不可用；`npm install --legacy-peer-deps` 因网络下载慢超时，已停止本次 npm 进程，前端完整构建待依赖安装完成后复跑。
- 风险/待确认：最终推送需要本机 GitHub 凭据可用；完整 3x-ui 能力较大，本轮优先交付可持续扩展的 MVP 骨架。

## 迭代计划

1. 确认三套源码的技术栈、入口和可复用能力边界。
2. 在 flux-panel 后端新增主控/副控服务器与协议部署任务的数据模型和 API 骨架。
3. 在前端新增服务器、协议、部署任务的管理入口，保持 flux-panel 现有 UI 风格。
4. 提取 Snell 安装脚本中的核心参数，形成可被主控下发的部署脚本模板。
5. 做最小构建/静态验证，并准备 Git 分支与推送。

## 任务清单

- [x] ~~**目标:** 完成源码勘察、融合范围确认和第一版可执行拆分计划~~ (创建于: 2026-05-18 22:03:49 | **完成于: 2026-05-18 22:07:56**)
- [x] ~~**目标:** 新增主控服务器、协议模板、部署任务与 Snell 安装脚本生成的后端 API 骨架~~ (创建于: 2026-05-18 22:07:56 | **完成于: 2026-05-18 22:44:43**)
- [x] ~~**目标:** 完成 Git 提交并推送到 GitHub 分支~~ (创建于: 2026-05-18 22:44:43 | **完成于: 2026-05-18 22:46:53**)
- [x] ~~**目标:** 撤回误推的远端分支并删除 PR 提示记录~~ (创建于: 2026-05-18 23:24:30 | **完成于: 2026-05-18 23:24:30**)
- [x] ~~**目标:** 创建自有仓库 `zhizhishu/flux-3xui-orchestrator`，补充 README，并推送当前项目~~ (创建于: 2026-05-18 23:29:20 | **完成于: 2026-05-18 23:34:10**)
- [ ] **目标:** 新增 GitHub Pages 项目官网并发布到 `github.io` (创建于: 2026-05-18 23:37:48)

## 推送记录

- 已撤回远端分支：`origin/codex/3xui-orchestrator-snell`
- 说明：没有创建 PR；之前的链接只是 GitHub 在 push 后自动输出的“可创建 PR”提示。
- 新仓库：`https://github.com/zhizhishu/flux-3xui-orchestrator`
- 当前 `origin`：`https://github.com/zhizhishu/flux-3xui-orchestrator.git`
- 原 `flux-panel` 远端已改名为 `upstream`，仅作来源参考。
- 当前分支：`main`
