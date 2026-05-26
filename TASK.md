# TASK.md

## 当前目标

把项目收口为一个独立的 Overlord Broil 单项目：单体 overlord-master 主控镜像、overlord-agent 被控执行器、默认单公网入口 5166/tcp，并清理旧分体运行面和旧产品命名残留。完成后推送 origin/main 和 origin/future，再检查 GitHub Actions / GHCR。

## 本轮已完成

- 项目根目录确认：C:\Users\echo\Downloads\claude\overlord-broil。
- GitHub remote 确认：origin -> https://github.com/zhizhishu/overlord-broil.git。
- GitHub Actions Docker workflow 已收口为只构建 / 推送 ghcr.io/zhizhishu/overlord-broil 单镜像。
- compose 默认形态已是 overlord-master 单体主控，主控只公开 5166/tcp。
- 新安装资源名已统一为 overlord-master、overlord-mysql、overlord-network、overlord.sql、overlord_master_logs。
- Agent 安装链路统一为 install-agent.sh / install-agent-bootstrap.sh / overlord-agent.sh 和 OB_* 环境变量。
- README、中文 README、docs 首页、Operations、Release Notes 已按 Overlord Broil 产品名更新，并保留 README 致谢区。
- DB 默认 app_name 改为 Overlord Broil，SQLite schema 和后端配置读取会修正历史旧值。
- 3x-ui inbound 注释、转发服务描述、README 截图文字已改为 Overlord Broil 产品语义。
- 已修复本轮批量替换造成的中文文档乱码。

## 已通过验证

- bash scripts/test-master-port-contract.sh
- bash scripts/test-agent-mock.sh
- bash scripts/test-compose-smoke.sh --build-local --dry-run
- bash scripts/test-compose-smoke.sh --compose-file docker-compose.sqlite.yml --build-local --dry-run
- bash scripts/test-sqlite-schema.sh
- bash scripts/test-three-xui-fixture.sh
- npm run build
- git diff --check，仅有仓库既有 LF/CRLF 提示。

## 下一步

1. 重跑最终本地验证。
2. 更新 LOG.md。
3. commit。
4. push origin main 和 origin main:future。
5. 检查 GitHub Actions、GHCR 镜像和 Pages。

## 风险

- 真实 VPS 矩阵仍未覆盖到 1.0 标准。
- 真实 3x-ui endpoint/token 的端到端测试需要外部服务器密钥。
- Snell 是产品层统一协议节点，底层仍是独立服务，不是 Xray 内核原生协议。

## Notes For Next Agent

- 不要在父级存放根目录写日志、计划或报告。
- 推送只面向 origin，不要向 upstream 开 PR 或推送。
- Serena 使用 Serena Pool。
- 主控默认入口是 5166；被控 Agent 默认不开放管理端口。
