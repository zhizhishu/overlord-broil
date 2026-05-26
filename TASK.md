# TASK.md

## 当前目标

在真机 `isrco-hk` 上验证 Overlord Broil 主控和被控 Agent 的真实安装 / 迁移流程, 并把发现的问题修复后推送 GitHub.

## 本轮已完成

- 已确认项目根目录: `C:\Users\echo\Downloads\claude\overlord-broil`.
- 已使用 Termius 控制真机 `isrco-hk`; 远端为 Debian 12, 约 `1.9 GiB` 内存, Docker `29.5.2`, Docker Compose `v5.1.4`.
- 真机旧分离栈已迁移为 SQLite 单体主控:
  - `overlord-master` 暴露 `5166/tcp`.
  - `vite-frontend` 已清理.
  - `springboot-backend` 已清理.
  - `gost-phpmyadmin` 已清理.
  - SQLite 模式下旧 `gost-mysql` 容器已清理, 未删除旧 volume 和安装文件.
- 已修复 installer: SQLite 迁移时会移除旧 `gost-mysql` 容器, 并在文档和测试中说明只移除容器, 不删除旧数据.
- 已修复 agent idle 行为: 主控返回 `data:null` 时视为正常空任务, 不再输出 `claim response did not include a task id`, 也不生成 task report.
- 已重写乱码的 `README.zh-CN.md` 和 `docs/index.html`, 并统一端口口径为默认只公开 `5166/tcp`.
- 已更新 UI/i18n 发布前检查文案: 默认只开放 `5166` 和业务端口, `6365` 仅调试时显式开放.
- 已提交并推送 `origin/main`: `8c20d3d Tighten real-host install migration`.

## 已通过验证

- 本地:
  - `bash -lc 'bash -n scripts/*.sh && sh -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh'`
  - `bash scripts/test-master-port-contract.sh`
  - `bash scripts/test-agent-mock.sh`
  - `npm run build`
  - `git diff --check` (仅 Windows LF/CRLF 提示)
- 真机 `isrco-hk`:
  - `docker ps` 仅显示 `overlord-master` 相关产品容器.
  - 旧容器检查: `vite-frontend=absent`, `springboot-backend=absent`, `gost-phpmyadmin=absent`, `gost-mysql=absent`.
  - 主控健康: `http://127.0.0.1:5166/flow/test -> test`.
  - 公网健康: `http://82.158.91.116:5166/flow/test -> test`, 首页 HTTP `200`.
  - 监听端口: 只有 `5166/tcp` 和 SSH `22/tcp`; 未见 `80/6365/8066`.
  - Agent service active, `/usr/local/bin/overlord-agent.sh` 已包含 `claim_state()`.
  - Agent 重启后的 journal 中 `idle_warning_after_restart=absent`.
  - 主控登录 API 返回 `code=0` 且 token 存在.

## 下一步

1. 更新 `LOG.md` 记录本次真机烟测结果.
2. 提交日志更新并推送 `origin/main`.
3. 检查 GitHub Actions / Docker Images / Pages 是否开始或完成最新提交.

## 风险/待确认

- 这轮是真机单台 Debian 验证, 还不是完整 VPS 矩阵.
- 真实 3x-ui endpoint/token 端到端写入仍需要专门真机目标.
- 默认账号 `admin_user/admin_user` 仅用于测试, 正式使用必须修改.
- 不在日志、提交或回复中暴露 token、密码、Cookie、私钥.
