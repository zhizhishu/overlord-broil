# PROJECT_ID.md

project_name: flux-3xui-orchestrator
project_root: C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator
project_type: code
task_file: C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator\TASK.md
log_file: C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator\LOG.md
legacy_task_log: C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator\TASK_LOG.md

serena:
  enabled: false
  activate: C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator
  reason: Optional code repository support. Enable only when Serena MCP is available and the active project can be verified.

boundaries:
  parent_storage_root: C:\Users\echo\Downloads\claude
  allowed_read:
    - C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator
  allowed_write:
    - C:\Users\echo\Downloads\claude\flux-panel-3xui-orchestrator
  forbidden_paths:
    - C:\Users\echo\Downloads\claude\flux-panel
    - C:\Users\echo\Downloads\claude\task-logs
    - C:\Users\echo\Downloads\claude\PROJECT_ID.md
    - C:\Users\echo\Downloads\claude\TASK.md
    - C:\Users\echo\Downloads\claude\LOG.md

notes:
  - This repository is the independent zhizhishu/flux-3xui-orchestrator project.
  - Do not open pull requests to the upstream Flux Panel repository.
  - The parent folder is a storage root only, not a project or logging location.
