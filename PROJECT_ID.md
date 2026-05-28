# PROJECT_ID.md

project_name: overlord-broil
project_root: C:\Users\echo\Downloads\claude\overlord-broil
project_type: code
task_file: C:\Users\echo\Downloads\claude\overlord-broil\TASK.md
log_file: C:\Users\echo\Downloads\claude\overlord-broil\LOG.md

startup_receipt:
  project_root: C:\Users\echo\Downloads\claude\overlord-broil
  project_type: code
  rules_loaded: global / project AGENTS / PROJECT_ID / TASK / skill
  task_file: TASK.md
  mcp_needed: yes
  subagent_allowed: yes

serena:
  enabled: true
  required: false
  activate: C:\Users\echo\Downloads\claude\overlord-broil
  reason: Use Serena Pool for cross-file code understanding and guarded semantic edits after verifying the active project.
ace:
  enabled: true
  required: false
  scope: C:\Users\echo\Downloads\claude\overlord-broil

boundaries:
  parent_storage_root: C:\Users\echo\Downloads\claude
  allowed_read:
    - C:\Users\echo\Downloads\claude\overlord-broil
  allowed_write:
    - C:\Users\echo\Downloads\claude\overlord-broil
  forbidden_paths:
    - C:\Users\echo\Downloads\claude\task-logs
    - C:\Users\echo\Downloads\claude\PROJECT_ID.md
    - C:\Users\echo\Downloads\claude\TASK.md
    - C:\Users\echo\Downloads\claude\LOG.md

notes:
  - This repository is the independent zhizhishu/overlord-broil project.
  - Do not open pull requests outside this repository.
  - The parent folder is a storage root only, not a project or logging location.
