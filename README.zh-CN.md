# Overlord Broil 中文说明

[English README](README.md)

Overlord Broil 是一个独立的主控 / 被控运维面板, 用来统一管理多服务器上的 Xray / Reality, Snell, 远端端口转发, 证书, 防火墙, 流量同步和 Agent 任务.

当前版本定位为 `0.6.0` 公开试用 / 正式候选. 它适合自用, 小规模授权服务器和公开展示, 但还不是承诺长期兼容的 `1.0` 商业级稳定版.

项目站点:

```text
https://zhizhishu.github.io/overlord-broil/
https://zhizhishu.github.io/
```

## 核心架构

默认运行形态是单体主控镜像:

```text
浏览器 / 被控 Agent
        |
        v
overlord-master :5166
  - 内置 Web UI
  - API
  - 任务引擎
  - 状态同步
  - Runtime Provider 层
        |
        v
MySQL Docker 内网
或 SQLite 本地文件
```

Runtime Provider 把不同运行时统一到同一套任务和 UI 模型:

| Provider | 管理内容 |
| --- | --- |
| `xrayRuntime` | Xray, Reality, inbound/outbound, 路由规则, IPv4/IPv6 策略, 流量同步, Xray restart |
| `snell` | Snell 服务, PSK, 端口, systemd/OpenRC 生命周期 |
| `forward` | 远端端口转发, socat, 服务状态, 规则流量 |
| `certificate` | ACME / 自签证书, 证书文件, 过期时间, 诊断 |
| `firewall` | 本机防火墙端口放行 / 关闭, 诊断结果 |

Snell 已统一到产品层的“协议节点”管理里, 但它不是 Xray 的原生协议. 底层仍由 Agent 在被控服务器上部署独立 Snell 服务.

## UI 预览

![Overlord Broil live control center](docs/assets/actual-control-center-top.png)

![Overlord Broil login](docs/assets/actual-login.png)

UI 方向是高信息密度的运维控制台: 服务器卡片, 操作分组, 状态 chip, 统一规则视图, Runtime State, 任务审计和中英文切换.

## 默认端口

| 角色 | 默认端口 | 说明 |
| --- | --- | --- |
| 主控 Web / API | `5166/tcp` | 浏览器和被控 Agent 都访问这一个入口 |
| 后端调试别名 | 默认不暴露 | 只有设置 `OB_EXPOSE_BACKEND=1` 才临时暴露 |
| phpMyAdmin | 默认不暴露 | 只有设置 `OB_PHPMYADMIN_PORT` 才临时暴露 |
| MySQL | 不暴露宿主机端口 | 只在 Docker 内网使用 |
| 被控 Agent | 不暴露管理端口 | Agent 主动轮询主控 |

被控服务器只需要开放你创建的业务端口, 例如可选 Xray Runtime 端口 `5168`, Xray inbound 端口, Snell 端口, 远端转发端口, 以及 ACME HTTP 模式需要的 `80/tcp`.

安装或升级时, 脚本会清理旧分离栈容器和临时 phpMyAdmin, 避免旧的 `80/6365/8066` 公网映射残留. 如果选择 SQLite 模式, 还会停止旧的 MySQL 容器, 但保留 Docker volume 和旧安装文件, 方便手动恢复.

## 安装主控

默认 MySQL 模式:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh | sudo bash
```

轻量 SQLite 模式:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh \
  | sudo env OB_DB_MODE="sqlite" OB_FRONTEND_PORT="5166" bash
```

Alpine 或极简系统:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master-bootstrap.sh | sudo sh
```

安装前预检:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

常用运维:

```bash
sudo bash /opt/overlord-broil/install-master.sh upgrade
sudo bash /opt/overlord-broil/install-master.sh backup
sudo bash /opt/overlord-broil/install-master.sh restore --backup-file /opt/overlord-broil/backups/overlord-master-backup-YYYYMMDD-HHMMSS.tar.gz
sudo bash /opt/overlord-broil/install-master.sh uninstall --yes
```

## 安装被控 Agent

先在主控里创建服务器, 然后从服务器卡片复制 Token 命令. 在被控服务器执行:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent.sh \
  | sudo env OB_PANEL_URL="http://MASTER_IP:5166" OB_SERVER_ID="1" OB_AGENT_TOKEN="paste-agent-token-here" bash
```

Alpine 或极简系统:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent-bootstrap.sh \
  | sudo env OB_PANEL_URL="http://MASTER_IP:5166" OB_SERVER_ID="1" OB_AGENT_TOKEN="paste-agent-token-here" sh
```

Agent 预检:

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent.sh \
  | sudo env OB_PANEL_URL="http://MASTER_IP:5166" OB_SERVER_ID="1" OB_AGENT_TOKEN="paste-agent-token-here" bash -s -- doctor
```

Agent 通过 systemd 或 OpenRC 常驻, 主动向主控领取任务, 本机执行, 再把结果回报给主控.

## 使用流程

1. 打开 `http://MASTER_IP:5166`.
2. 登录后进入主控中心.
3. 登记被控服务器.
4. 用生成的 Token 命令安装 Agent.
5. 等待心跳正常.
6. 选择一个或多个服务器执行编排:
   - 安装或复用 Xray Runtime.
   - 创建 VLESS Reality, VMess WebSocket, Trojan TLS, Shadowsocks 节点.
   - 部署 Snell 节点.
   - 配置证书和防火墙.
   - 同步规则和流量.
7. 用服务器卡片, State Sync, 任务卡片和操作审计查看状态.

## API 入口

主控统一入口:

```text
http://MASTER_IP:5166
```

常用 API:

```text
POST /api/v1/control-server/list
POST /api/v1/protocol-node/create
POST /api/v1/server-forward/create
POST /api/v1/server-rule/overview
POST /api/v1/runtimes/xray/inbounds/list
POST /api/v1/runtimes/xray/outbounds
POST /api/v1/runtimes/xray/traffic/sync
POST /api/v1/runtimes/xray/restart-xray
POST /api/v1/deploy-task/create
POST /api/v1/agent-task/claim
POST /api/v1/agent-task/report
```

## 低内存服务器

| 内存 | 策略 |
| --- | --- |
| `< 200 MB` | Nano critical. 阻止完整 Xray Runtime 编排和 Xray 节点创建, 建议 Snell 或远端转发 |
| `< 256 MB` | Nano. 显示强提醒, 只建议轻量任务 |
| `< 512 MB` | Small. 需要 swap 和低并发才适合跑完整代理栈 |

Alpine/OpenRC 支持 Agent, Snell 和远端转发. 完整 Xray Runtime 安装 / 配置编排主要面向 systemd 主机.

## 验证命令

```bash
bash -n scripts/*.sh
sh -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh
bash scripts/test-agent-mock.sh
bash scripts/test-xray-runtime-fixture.sh
bash scripts/test-sqlite-schema.sh
bash scripts/test-master-port-contract.sh
```

前端:

```bash
cd vite-frontend
npm install --legacy-peer-deps
npm run build
```

后端 Docker 构建:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v overlord-broil-m2:/root/.m2 \
  -w /workspace/springboot-backend \
  maven:3.9.9-eclipse-temurin-21 \
  mvn -B -DskipTests package
```

真实 Xray Runtime 合同烟测是可选项. 没有配置真实地址和 API token 时会自动跳过:

```bash
export XRAY_RUNTIME_E2E_URL="https://xray-runtime.example.com:5168"
export XRAY_RUNTIME_E2E_TOKEN="YOUR_XRAY_RUNTIME_API_TOKEN"
bash scripts/test-xray-runtime-e2e.sh
```

真实 Snell smoke 只在授权主机上运行:

```bash
OB_MASTER_URL="http://127.0.0.1:5166" OB_SNELL_PORT=18390 bash scripts/test-snell-real-smoke.sh
```

## 镜像

主控镜像:

```text
ghcr.io/zhizhishu/overlord-broil:latest
```

GitHub Actions 从 `main` 和 tag 构建公开镜像. `future` 用于持续验证.

## 致谢

Overlord Broil 是独立项目, 不是以下项目的官方发行版. 项目设计参考了:

- [Flux Panel](https://github.com/zhizhishu/flux-panel): UI 风格, 转发面板基础和项目结构参考.
- Xray-compatible panel APIs: inbound/outbound, routing, traffic 和运行时管理兼容行为.
- [snell.sh](https://github.com/jinqians/snell.sh): Snell 安装流程和部署脚本行为参考.
- [Komari Monitor](https://github.com/komari-monitor/komari): 主控 / 被控监控和多服务器运维思路.

## 安全提醒

只在你拥有或被授权管理的服务器上使用. 不要用于未授权访问, 滥用, 绕过, 违法行为或违反服务条款的用途.
