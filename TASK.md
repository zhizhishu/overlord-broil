# TASK.md

## 当前目标

在真机 `isrco-hk` 上验证 Overlord Broil 主控和被控 Agent 的真实安装/迁移流程，重点确认旧分离栈能迁移到单体 `overlord-master`，默认只公开 `5166/tcp`，被控 Agent 不开放管理端口，并找出真实安装中的 bug。

## 本轮已完成

- 项目根目录确认：`C:\Users\echo\Downloads\claude\overlord-broil`。
- 远端授权确认：本轮允许使用 Termius 控制 `isrco-hk`，并按需使用 MCP、Serena Pool、ACE 和 subagent。
- Termius bridge 已连接，目标终端为 `Termius - isrco-hk`，xterm id `5`，远端提示符 `root@localhost`。
- 真机预检发现当前远端仍运行旧分离栈：
  - `vite-frontend` 暴露 `80/tcp`
  - `springboot-backend` 暴露 `6365/tcp`
  - `gost-phpmyadmin` 暴露 `8066/tcp`
  - `gost-mysql` 仅 Docker 内网
- 远端系统：Debian 12，约 `1.9GiB` 内存，Docker `29.5.2`，Docker Compose `v5.1.4`。
- 只读 explorer 建议本轮真机烟测用 SQLite 主控，减少端口和 sidecar 干扰。

## 下一步

1. 在 `isrco-hk` 上备份/记录旧状态。
2. 用最新版 `install-master.sh` 安装 SQLite 主控：`OB_DB_MODE=sqlite OB_FRONTEND_PORT=5166`。
3. 验证旧分离栈容器是否被清理，新主控是否只暴露 `5166/tcp`。
4. 验证 `http://127.0.0.1:5166/flow/test` 和公网 `http://SERVER_IP:5166`。
5. 创建/获取 server token 后安装本机 Agent 指向主控。
6. 验证 Agent heartbeat、claim/report、日志和服务状态。
7. 如发现 bug，修复代码、跑本地/远端验证、提交并推送 GitHub。

## 验证状态

- 本地代码验证：上一轮已通过 shell、agent mock、3x-ui fixture、SQLite schema、frontend build、Docker Maven package。
- 真机验证：进行中。

## 风险/待确认

- 远端当前旧分离栈仍占用 `80/6365/8066`，这是本轮迁移测试的核心风险。
- 默认账号 `admin_user/admin_user` 仅用于测试，正式使用必须修改。
- 不在日志、提交或回复中暴露 token、密码、Cookie、私钥。
- SQLite 适合烟测和轻量自用；长期生产默认仍可选 MySQL。
