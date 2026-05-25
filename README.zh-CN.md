# Flux 3x-ui Orchestrator 中文说明

[English README](README.md)

Flux 3x-ui Orchestrator 是一个独立的主控 / 被控运维面板。它以 Flux Panel 的 UI 方向和转发面板能力为基础，融合 3x-ui / Xray / Reality、Snell、远端端口转发、证书、防火墙、流量同步和多服务器 Agent 运维。

当前版本：`0.6.0`，定位为公开试用 / 正式候选版本。它适合自用、小规模授权服务器和公开展示，但还不是承诺长期兼容的 `1.0` 商业级稳定版。

项目站点：

```text
https://zhizhishu.github.io/flux-3xui-orchestrator/
https://zhizhishu.github.io/
```

## 核心架构

默认运行形态是 `flux-master` 单体主控镜像：

```text
用户浏览器 / 被控 Agent
        |
        v
flux-master :5166
  - 内置 Web UI
  - API
  - 任务引擎
  - 状态同步
  - Runtime Provider 层
        |
        v
MySQL Docker 内网
```

Runtime Provider 层把不同运行时统一到同一套任务和 UI 模型：

| Provider | 作用 | 执行方式 | Nano 主机 |
| --- | --- | --- | --- |
| `xui` | 3x-ui / Xray / Reality / 入站 / 出站 / 流量 | 主控 API + Agent 任务 | 不建议 |
| `snell` | Snell 节点服务 | Agent 任务 | 支持 |
| `forward` | TCP/UDP 远端端口转发 | Agent 任务 | 支持 |
| `certificate` | 自签 / ACME / 证书诊断 | Agent 任务 | 视任务而定 |
| `firewall` | 防火墙诊断和运行时端口放行 | Agent 任务 | 支持 |

Snell 已统一到产品层的“协议节点”管理里，但它不是 Xray 或 3x-ui 的原生协议。底层仍然由 Agent 在被控服务器上部署独立 Snell 服务，这样更符合 Snell 的实际运行方式。

Runtime Provider 元数据现在会从主控领取任务一路跟到 Agent 回报结果。Agent 会记录正在执行的 provider，并把它写入 `resultJson.runtimeProvider`；如果旧 Agent 没带这段信息，主控保存任务结果时也会兜底补上审计元数据。

## UI 方向

UI 继续靠近 Flux Panel：高信息密度、服务器卡片、操作分组、状态 chip、统一规则视图。它不是营销落地页，而是运维控制台。

![Flux 3x-ui Orchestrator 主控预览](docs/assets/flux-orchestrator-screenshot.svg)

当前主控 UI 包含：

- 服务器注册、Token、心跳、状态卡片
- 3x-ui / Xray 入站、出站、配置、流量和重启
- Snell 节点创建、重启和卸载
- 远端端口转发规则
- Runtime Provider 可视化入口
- Agent 诊断、日志、重启、升级、卸载和一键修复
- 监控告警和统一规则中心
- `zh-CN` / `en-US` 语言切换

## 默认端口

主控默认只暴露一个公网入口：

| 端口 | 用途 | 默认是否暴露 |
| --- | --- | --- |
| `5166/tcp` | 主控 Web UI、API、Agent 回调 | 是 |
| `6365/tcp` | 后端调试别名 | 否，仅 `FLUX_EXPOSE_BACKEND=1` 时暴露 |
| `3306/tcp` | MySQL | 否，仅 Docker 内网 |
| phpMyAdmin | 临时维护 | 否，仅设置 `FLUX_PHPMYADMIN_PORT` 时暴露 |

被控服务器不需要暴露 Agent 管理端口。Agent 主动连接主控，例如：

```text
http://MASTER_IP:5166
```

被控服务器只会根据你创建的业务节点暴露端口，例如：

- 3x-ui 面板端口，默认建议 `5168`
- Xray / Reality 入站端口
- Snell 监听端口
- 远端转发监听端口
- ACME HTTP 模式需要的 `80/tcp`

## 一键安装主控

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

Alpine 或极简系统没有 `bash` 时：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master-bootstrap.sh | sudo sh
```

安装前预检：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

常用参数：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_FRONTEND_PORT="5166" FLUX_NETWORK_STACK="v4" bash
```

升级、备份、恢复、卸载：

```bash
sudo bash /opt/flux-3xui-orchestrator/install-master.sh upgrade
sudo bash /opt/flux-3xui-orchestrator/install-master.sh backup
sudo bash /opt/flux-3xui-orchestrator/install-master.sh restore --backup-file /opt/flux-3xui-orchestrator/backups/flux-master-backup-YYYYMMDD-HHMMSS.tar.gz
sudo bash /opt/flux-3xui-orchestrator/install-master.sh uninstall --yes
```

## 安装被控 Agent

先在主控的“主控中心”创建服务器，点击服务器卡片上的 `Token` 获取 `FLUX_SERVER_ID` 和 `FLUX_AGENT_TOKEN`。

然后在被控服务器执行：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://MASTER_IP:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash
```

Alpine 或极简系统：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent-bootstrap.sh \
  | sudo env FLUX_PANEL_URL="http://MASTER_IP:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" sh
```

被控端预检：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://MASTER_IP:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash -s -- doctor
```

Agent 安装后会通过 systemd 或 OpenRC 常驻运行，主动向主控拉取任务、在本机执行、再回报结果。
领取到的任务会携带 Runtime Provider 分配结果，后续任务历史可以按 `xui`、`snell`、`forward`、`certificate`、`firewall` 审计。

## 怎么用

1. 安装主控，打开 `http://MASTER_IP:5166`。
2. 登录后台，进入“主控中心”。
3. 创建服务器，获取 Agent 安装命令。
4. 在被控服务器安装 Agent，等待心跳在线。
5. 选择一台或多台服务器，执行一键编排：
   - 安装或复用 3x-ui
   - 创建 VLESS Reality、VMess WebSocket、Trojan TLS、Shadowsocks 节点
   - 部署 Snell 节点
   - 申请或配置证书
   - 同步规则和流量
6. 后续在服务器卡片中管理入站、出站、Snell、转发、证书、防火墙和 Agent 运维任务。

## 低内存服务器

Agent 心跳会上报总内存。主控会自动识别低内存档位：

| 档位 | 内存 | 策略 |
| --- | --- | --- |
| `nano-critical` | `< 200 MB` | 阻止完整 3x-ui / Xray 编排，建议 Snell 或端口转发 |
| `nano` | `< 256 MB` | 显示 Nano 提醒，谨慎创建重运行时任务 |
| `small` | `< 512 MB` | 建议开启 swap 后再跑复杂节点 |
| `standard` | `>= 512 MB` | 正常路径 |

## 支持系统

| 目标 | Debian / Ubuntu | Rocky / Oracle Linux | Alpine / OpenRC |
| --- | --- | --- | --- |
| 主控 Docker 栈 | 支持 | 支持 | 支持 bootstrap |
| Agent 服务 | systemd | systemd | OpenRC |
| Snell 节点 | systemd | systemd | OpenRC |
| 远端转发 | systemd + `socat` | systemd + `socat` | OpenRC + `socat` |
| 完整 3x-ui 安装配置 | 支持 | 支持 | `0.6.0` 暂不支持 |

## Docker / GHCR 镜像

默认主控镜像：

```text
ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest
```

遗留前后端分离镜像保留用于回滚和调试：

```text
ghcr.io/zhizhishu/flux-3xui-orchestrator-backend:latest
ghcr.io/zhizhishu/flux-3xui-orchestrator-frontend:latest
```

`main` 和 `v*` tag 会推送 GHCR 镜像。`future` 分支用于验证未来能力，默认只构建检查，不覆盖正式镜像。

## API 摘要

Runtime Provider：

```text
POST /api/v1/runtime-provider/list
POST /api/v1/runtime-provider/resolve
```

核心任务链路：

```text
POST /api/v1/control-server/create
POST /api/v1/control-server/list
POST /api/v1/control-server/token
POST /api/v1/control-server/heartbeat
POST /api/v1/deploy-task/create
POST /api/v1/deploy-task/orchestrate
POST /api/v1/deploy-task/list
POST /api/v1/deploy-task/retry
POST /api/v1/agent-task/claim
POST /api/v1/agent-task/report
```

节点、转发和 3x-ui：

```text
POST /api/v1/protocol-node/create
POST /api/v1/protocol-node/list
POST /api/v1/protocol-node/sync
POST /api/v1/server-forward/create
POST /api/v1/server-forward/list
POST /api/v1/server-rule/overview
POST /api/v1/three-xui/inbounds/list
POST /api/v1/three-xui/outbounds
POST /api/v1/three-xui/traffic/sync
POST /api/v1/three-xui/restart-xray
```

## 本地验证

```bash
bash scripts/release-check.sh --full
```

没有本机 Maven 时可以用 Docker：

```bash
docker run --rm -v "$PWD/springboot-backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -DskipTests package
```

前端：

```bash
cd vite-frontend
npm install --legacy-peer-deps
npm run build
```

## 离 1.0 还差什么

- 真实 VPS 矩阵：Debian、Ubuntu、Rocky、Oracle Linux、Alpine。
- 真实 3x-ui 容器或 VPS 端到端烟测。
- 更完整的证书、防火墙和云安全组诊断。
- RBAC、审计日志、Agent token 过期 / 吊销、密钥轮换。
- 移动端、加载态、失败态和任务详情继续打磨。

## 致谢

本项目是独立项目，不是下列项目的官方发行版，但参考并感谢它们：

- [Flux Panel](https://github.com/zhizhishu/flux-panel)：UI 风格、转发面板基础和项目结构参考。
- [3x-ui](https://github.com/MHSanaei/3x-ui)：Xray / 3x-ui 协议管理模型和远端面板 API 行为参考。
- [snell.sh](https://github.com/jinqians/snell.sh)：Snell 安装流程和部署脚本行为参考。
- [Komari Monitor](https://github.com/komari-monitor/komari)：主控 / Agent 监控和多服务器运维思路参考。

## 安全说明

本项目仅用于你拥有或被授权管理的服务器。请不要用于未授权访问、滥用、规避监管、违法用途或违反服务条款的行为。
