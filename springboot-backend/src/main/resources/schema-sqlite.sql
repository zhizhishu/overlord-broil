CREATE TABLE IF NOT EXISTS forward (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  name TEXT NOT NULL,
  tunnel_id INTEGER NOT NULL,
  in_port INTEGER NOT NULL,
  out_port INTEGER,
  remote_addr TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'fifo',
  interface_name TEXT,
  in_flow INTEGER NOT NULL DEFAULT 0,
  out_flow INTEGER NOT NULL DEFAULT 0,
  created_time INTEGER NOT NULL,
  updated_time INTEGER NOT NULL,
  status INTEGER NOT NULL,
  inx INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS node (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  secret TEXT NOT NULL,
  ip TEXT,
  server_ip TEXT NOT NULL,
  port_sta INTEGER NOT NULL,
  port_end INTEGER NOT NULL,
  version TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS control_server (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  endpoint TEXT,
  host TEXT NOT NULL,
  xray_panel_endpoint TEXT,
  xray_panel_base_path TEXT,
  xray_panel_api_token TEXT,
  xray_panel_username TEXT,
  xray_panel_password TEXT,
  xray_panel_two_factor_code TEXT,
  xray_panel_allow_insecure INTEGER NOT NULL DEFAULT 0,
  xray_panel_last_sync INTEGER,
  ssh_port INTEGER DEFAULT 22,
  ssh_user TEXT DEFAULT 'root',
  api_token TEXT NOT NULL,
  allow_insecure INTEGER NOT NULL DEFAULT 0,
  agent_version TEXT,
  xray_version TEXT,
  snell_version TEXT,
  xray_panel_service_status TEXT,
  xray_service_status TEXT,
  snell_service_status TEXT,
  certificate_mode TEXT,
  certificate_domain TEXT,
  certificate_status TEXT,
  certificate_expire_at INTEGER,
  last_heartbeat INTEGER,
  cpu_usage REAL,
  memory_usage REAL,
  memory_total_mb INTEGER,
  low_memory_mode INTEGER NOT NULL DEFAULT 0,
  low_memory_profile TEXT,
  low_memory_advice TEXT,
  upload_traffic INTEGER,
  download_traffic INTEGER,
  last_error TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_control_server_api_token ON control_server (api_token);

CREATE TABLE IF NOT EXISTS protocol_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  version_family TEXT,
  listen_port INTEGER,
  transport TEXT,
  remark TEXT,
  config_json TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_node (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  server_name TEXT,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  engine TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  listen TEXT,
  port INTEGER,
  transport TEXT,
  security TEXT,
  credential_json TEXT,
  config_json TEXT,
  remote_id TEXT,
  service_name TEXT,
  state TEXT,
  up INTEGER NOT NULL DEFAULT 0,
  down INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  last_sync INTEGER,
  last_error TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_protocol_node_server_id ON protocol_node (server_id);
CREATE INDEX IF NOT EXISTS idx_protocol_node_engine ON protocol_node (engine);
CREATE INDEX IF NOT EXISTS idx_protocol_node_protocol ON protocol_node (protocol);
CREATE INDEX IF NOT EXISTS idx_protocol_node_remote_id ON protocol_node (remote_id);

CREATE TABLE IF NOT EXISTS server_forward_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  server_name TEXT,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  listen_host TEXT DEFAULT '0.0.0.0',
  listen_port INTEGER NOT NULL,
  target_host TEXT NOT NULL,
  target_port INTEGER NOT NULL,
  engine TEXT DEFAULT 'socat',
  service_name TEXT,
  state TEXT,
  up INTEGER NOT NULL DEFAULT 0,
  down INTEGER NOT NULL DEFAULT 0,
  last_sync INTEGER,
  last_error TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_server_forward_rule_server_id ON server_forward_rule (server_id);
CREATE INDEX IF NOT EXISTS idx_server_forward_rule_listen_port ON server_forward_rule (listen_port);
CREATE INDEX IF NOT EXISTS idx_server_forward_rule_service_name ON server_forward_rule (service_name);

CREATE TABLE IF NOT EXISTS deploy_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  server_name TEXT,
  protocol TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'present',
  state TEXT NOT NULL DEFAULT 'generated',
  request_json TEXT,
  script TEXT,
  result_json TEXT,
  started_time INTEGER,
  finished_time INTEGER,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deploy_task_server_id ON deploy_task (server_id);

CREATE TABLE IF NOT EXISTS monitor_alert (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  server_name TEXT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  detail_json TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledged_time INTEGER,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitor_alert_server_id ON monitor_alert (server_id);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_alert_type ON monitor_alert (alert_type);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_acknowledged ON monitor_alert (acknowledged);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_last_seen_at ON monitor_alert (last_seen_at);

CREATE TABLE IF NOT EXISTS operation_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  server_id INTEGER,
  server_name TEXT,
  provider_key TEXT,
  action TEXT,
  danger INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL,
  summary TEXT,
  detail_json TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operation_audit_server_id ON operation_audit_log (server_id);
CREATE INDEX IF NOT EXISTS idx_operation_audit_event_type ON operation_audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_operation_audit_provider_key ON operation_audit_log (provider_key);
CREATE INDEX IF NOT EXISTS idx_operation_audit_outcome ON operation_audit_log (outcome);
CREATE INDEX IF NOT EXISTS idx_operation_audit_created_time ON operation_audit_log (created_time);

CREATE TABLE IF NOT EXISTS xray_panel_traffic_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  server_name TEXT,
  source_type TEXT NOT NULL,
  inbound_id INTEGER,
  inbound_remark TEXT,
  protocol TEXT,
  tag TEXT,
  email TEXT,
  client_id TEXT,
  up INTEGER NOT NULL DEFAULT 0,
  down INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  expiry_time INTEGER,
  enable INTEGER,
  synced_time INTEGER NOT NULL,
  raw_json TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_xray_panel_traffic_snapshot_server_id ON xray_panel_traffic_snapshot (server_id);
CREATE INDEX IF NOT EXISTS idx_xray_panel_traffic_snapshot_source_type ON xray_panel_traffic_snapshot (source_type);
CREATE INDEX IF NOT EXISTS idx_xray_panel_traffic_snapshot_synced_time ON xray_panel_traffic_snapshot (synced_time);

CREATE TABLE IF NOT EXISTS speed_limit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  speed INTEGER NOT NULL,
  tunnel_id INTEGER NOT NULL,
  tunnel_name TEXT NOT NULL,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS statistics_flow (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  flow INTEGER NOT NULL,
  total_flow INTEGER NOT NULL,
  time TEXT NOT NULL,
  created_time INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tunnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  traffic_ratio REAL NOT NULL DEFAULT 1.0,
  in_node_id INTEGER NOT NULL,
  in_ip TEXT NOT NULL,
  out_node_id INTEGER NOT NULL,
  out_ip TEXT NOT NULL,
  type INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tls',
  flow INTEGER NOT NULL,
  tcp_listen_addr TEXT NOT NULL DEFAULT '[::]',
  udp_listen_addr TEXT NOT NULL DEFAULT '[::]',
  interface_name TEXT,
  created_time INTEGER NOT NULL,
  updated_time INTEGER NOT NULL,
  status INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  pwd TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  exp_time INTEGER NOT NULL,
  flow INTEGER NOT NULL,
  in_flow INTEGER NOT NULL DEFAULT 0,
  out_flow INTEGER NOT NULL DEFAULT 0,
  flow_reset_time INTEGER NOT NULL,
  num INTEGER NOT NULL,
  created_time INTEGER NOT NULL,
  updated_time INTEGER,
  status INTEGER NOT NULL
);

INSERT OR IGNORE INTO user (
  id, user, pwd, role_id, exp_time, flow, in_flow, out_flow,
  flow_reset_time, num, created_time, updated_time, status
) VALUES (
  1, 'admin_user', '3c85cdebade1c51cf64ca9f3c09d182d', 0, 2727251700000, 99999, 0, 0,
  1, 99999, 1748914865000, 1754011744252, 1
);

CREATE TABLE IF NOT EXISTS user_tunnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tunnel_id INTEGER NOT NULL,
  speed_id INTEGER,
  num INTEGER NOT NULL,
  flow INTEGER NOT NULL,
  in_flow INTEGER NOT NULL DEFAULT 0,
  out_flow INTEGER NOT NULL DEFAULT 0,
  flow_reset_time INTEGER NOT NULL,
  exp_time INTEGER NOT NULL,
  status INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vite_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  time INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vite_config_name ON vite_config (name);

INSERT OR IGNORE INTO vite_config (id, name, value, time)
VALUES (1, 'app_name', 'Overlord Broil', 1755147963000);

UPDATE vite_config
SET value = 'Overlord Broil', time = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE name = 'app_name' AND lower(value) IN ('flux', 'flux panel', 'flux Xray Panel orchestrator');
