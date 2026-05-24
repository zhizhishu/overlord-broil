# Flux 3x-ui Orchestrator 中文说明

[English README](README.md)

Flux 3x-ui Orchestrator 是一个基于 Flux Panel UI 和转发面板能力演进出来的主控/被控面板。目标是让一个主控面板统一管理多台服务器上的 3x-ui、Xray、Reality、Snell、远端端口转发、证书状态、流量同步和 agent 运维任务。

本项目是独立项目，不会向上游 Flux Panel 作者仓库提交 PR。上游仓库只作为 UI 和转发面板基础参考。

项目站点：

```text
https://zhizhishu.github.io/flux-3xui-orchestrator/
https://zhizhishu.github.io/
```

当前版本：`0.6.0`，定位是公开试用 / 可靠性候选版。可以用于自用和小规模授权服务器测试，但还不是承诺长期兼容的 `1.0` 商业级正式版。

## UI 语言

当前控制台默认是中文 UI，并已加入 `zh-CN` / `en-US` 语言切换。切换按钮在主布局、H5 布局和公共导航中可见，语言会写入浏览器本地存储，并同步更新页面 `lang`。

目前中英文切换已覆盖主控中心、服务器卡片、一键编排、3x-ui 入站/出站、Snell 节点、远端转发、Agent 诊断/日志/升级、主导航和密码弹窗。旧 Flux 转发页面仍可继续沿用同一套字典分批补齐。

## UI 预览

![Flux 3x-ui Orchestrator 主控工作台](docs/assets/flux-orchestrator-screenshot.svg)

UI 方向继续贴近 Flux Panel：信息密度高、服务器卡片清晰、操作分组明确、状态 chip 紧凑、规则视图统一。它不是落地页，而是运维控制台：选择一台或多台服务器，然后生成 agent 任务、管理 3x-ui 出入站、部署 Snell、同步流量、查看证书和服务状态。

## 已覆盖能力

- 主控面板：
  - Docker Compose 一键安装。
  - MySQL、后端、前端、可选 phpMyAdmin。
  - 服务器注册、Token 生成/轮换、心跳、状态回写。
  - 主控自控保护，避免误操作破坏主控端口和核心服务。
- 被控 agent：
  - systemd/OpenRC 常驻安装。
  - `claim/report` 任务通道。
  - Snell、3x-ui 编排、远端转发和 agent 维护任务。
  - 远程诊断、日志、重启、升级。
- 3x-ui / Xray：
  - 连接测试。
  - 入站列表、新增、更新、删除。
  - 客户端操作、流量重置、Xray 配置读取、出站读取、Xray 重启。
  - 3x-ui 流量快照同步到本地数据库。
- Snell：
  - 作为产品层统一协议节点管理。
  - 通过 agent 在被控服务器上安装为 systemd/OpenRC 服务。
  - 与 Xray/Reality 节点一起进入节点和规则视图。
- 远端端口转发：
  - 通过 `socat` + systemd/OpenRC 创建远端转发服务。
  - 纳入统一规则视图。
- 验证：
  - 后端 Maven 构建。
  - 前端 Vite 构建。
  - agent mock。
  - 3x-ui API fixture。
  - Docker Compose smoke。
  - Debian / Ubuntu / Alpine / Rocky Linux / Oracle Linux 安装矩阵预检。

## 一键安装主控

默认使用 GitHub Actions 构建的 GHCR 镜像：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh | sudo bash
```

Alpine 或极简系统没有 `bash` 时，先用 POSIX bootstrap：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master-bootstrap.sh | sudo sh
```

安装前建议先跑预检：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo bash -s -- doctor
```

常用端口：

| 端口 | 组件 | 说明 |
| --- | --- | --- |
| `5166` | 前端面板 | 默认公开访问入口，可用 `FLUX_FRONTEND_PORT` 修改；不再默认占用 `80` |
| `6365` | 后端 API / agent 回调 | 可用 `FLUX_BACKEND_PORT` 修改 |
| 默认不暴露 | phpMyAdmin | 容器内部服务；需要临时维护时才设置 `FLUX_PHPMYADMIN_PORT` 或 `--phpmyadmin-port` 暴露 |
| `3306` | MySQL | 默认只在容器内部使用，不发布到宿主机 |

被控服务器还会根据你的编排选择产生额外端口：3x-ui 面板默认 `5168`、Xray 入站端口、Snell 监听端口、远端转发监听端口，以及 ACME HTTP 模式需要的 `80` 端口。

如果确实需要临时打开 phpMyAdmin：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-master.sh \
  | sudo env FLUX_PHPMYADMIN_PORT="18066" bash
```

## 安装被控 agent

先在主控面板的 `主控中心` 创建服务器，点击服务器卡片上的 `Token`，拿到 `FLUX_SERVER_ID` 和 `FLUX_AGENT_TOKEN`。

然后在被控服务器执行：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://your-master-panel:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash
```

Alpine 或极简系统：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent-bootstrap.sh \
  | sudo env FLUX_PANEL_URL="http://your-master-panel:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" sh
```

被控端预检：

```bash
curl -fsSL https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main/scripts/install-flux-agent.sh \
  | sudo env FLUX_PANEL_URL="http://your-master-panel:5166" FLUX_SERVER_ID="1" FLUX_AGENT_TOKEN="paste-agent-token-here" bash -s -- doctor
```

## 主控怎么用

1. 打开主控面板，登录后台。
2. 进入 `主控中心`。
3. 添加服务器，填写被控服务器名称、地址、3x-ui 地址/API Token 等信息。
4. 点击 `Token`，把 agent 安装命令放到被控服务器执行。
5. 被控服务器上线后，在主控里选择一台或多台服务器。
6. 点击 `一键编排`：
   - 可安装/配置 3x-ui。
   - 可创建 VLESS Reality、VMess WebSocket、Trojan TLS、Shadowsocks。
   - 可部署 Snell。
   - 可配置证书模式。
7. 后续在服务器卡片上可以继续：
   - 看 `入站`、`出站`、`配置`、`出站流量`。
   - `同步节点`、`同步流量`。
   - 查看 `规则总览`。
   - 执行 agent `诊断`、`日志`、`重启`、`升级`。

## Snell 和 3x-ui 的关系

Snell 已经融合到产品层的“协议节点”管理里，所以你可以在主控里把 Snell 和 3x-ui/Xray 节点放在同一个视图里管理。

但底层实现上，Snell 不是 Xray 内核协议，也不是 3x-ui 原生协议。它由 Flux agent 在被控服务器上部署成独立服务。这样做更稳，也更符合 Snell 的实际运行方式。

## `future` 分支和 GHCR 镜像策略

`future` 是后续正式版能力的验证分支。它会触发 GitHub Actions，做完整 CI 和 Docker 镜像构建验证。

但是 `future` 不会把镜像推送到 GHCR。原因是：

- `future` 是试验/验证分支，不应该覆盖或污染正式镜像。
- GHCR 权限和包可见性通常按发布路径配置，非正式分支推送容易遇到权限拒绝。
- 只有 `main` 和 `v*` tag 才代表正式发布入口，适合推送可被用户拉取的镜像。

当前策略：

| 分支/标签 | 是否构建镜像 | 是否推送 GHCR | 用途 |
| --- | --- | --- | --- |
| `future` | 是 | 否 | 验证未来功能能不能构建 |
| `main` | 是 | 是 | 当前正式可安装版本 |
| `v*` tag | 是 | 是 | 发布版本 |
| PR | 是 | 否 | 只做检查 |

## 离 1.0 正式版还差什么

当前已经是可公开试用的 `0.6.0 RC`，但离长期稳定的 `1.0` 还差这些：

1. 真机 VPS 矩阵：Debian、Ubuntu、Rocky Linux、Oracle Linux、Alpine 各拉真实机器，从主控安装到被控编排完整跑一遍。
2. 真实 3x-ui E2E：现在有 API fixture，还需要真实 3x-ui 容器或 VPS 端到端烟测。
3. 证书和防火墙诊断：ACME HTTP 模式需要更明确提示 DNS、80 端口、系统防火墙、云安全组问题。
4. 安全治理：RBAC、审计日志、agent token 过期/吊销、密钥轮换、危险操作二次确认。
5. UI 收尾：移动端、空状态、加载态、失败态、错误文案和任务详情继续打磨。
6. 运维闭环：agent 自动升级验证、一键健康修复、远端日志保留、失败重试策略。

`future` 分支下一步优先级：

- P0：真实 VPS 矩阵 + 真实 3x-ui E2E。
- P1：agent 升级、修复、日志拉取硬化。
- P2：RBAC、审计日志、token 生命周期。
- P3：UI/移动端/错误态继续打磨。

## 本地开发验证

前端：

```bash
cd vite-frontend
npm install --legacy-peer-deps
npm run build
```

后端：

```bash
cd springboot-backend
mvn package
```

推荐发布前验证：

```bash
bash scripts/release-check.sh --full
```

如果本机没有 Java/Maven，可以用 Docker Maven：

```bash
docker run --rm -v "$PWD/springboot-backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -DskipTests package
```

## 致谢与参考

- [Flux Panel](https://github.com/zhizhishu/flux-panel)：UI 风格、转发面板基础和原始项目结构参考。
- [3x-ui](https://github.com/MHSanaei/3x-ui)：Xray/3x-ui 协议管理模型和远程面板 API 行为参考。
- [snell.sh](https://github.com/jinqians/snell.sh)：Snell 安装流程和部署脚本行为参考。
- [Komari Monitor](https://github.com/komari-monitor/komari)：主控/agent 监控思路参考。

## 安全说明

本项目仅用于你拥有或被授权管理的服务器。不要用于未授权访问、滥用、绕过监管、违法用途或违反服务条款的行为。
