import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// 用户管理相关类型
export interface User {
  id: number;
  name?: string;
  user: string;
  pwd?: string;
  status: number; // 1-正常, 0-禁用
  flow: number; // 流量限制(GB)
  num: number; // 转发数量
  expTime?: number; // 过期时间戳
  flowResetTime?: number; // 流量重置日期(1-31号)
  createdTime?: number; // 创建时间戳
  inFlow?: number; // 下载流量(字节)
  outFlow?: number; // 上传流量(字节)
}

export interface UserForm {
  id?: number;
  name?: string;
  user: string;
  pwd?: string;
  status: number;
  flow: number;
  num: number;
  expTime: Date | null;
  flowResetTime: number;
}

export interface UserTunnel {
  id: number;
  userId: number;
  tunnelId: number;
  tunnelName: string;
  status: number; // 1-正常, 0-禁用
  flow: number; // 流量限制(GB)
  num: number; // 转发数量
  expTime: number; // 过期时间戳
  flowResetTime: number; // 流量重置日期
  speedId?: number | null; // 限速规则ID
  speedLimitName?: string; // 限速规则名称
  inFlow?: number; // 下载流量(字节)
  outFlow?: number; // 上传流量(字节)
  tunnelFlow?: number; // 隧道流量计算类型(1-单向, 2-双向)
}

export interface UserTunnelForm {
  tunnelId: number | null;
  flow: number;
  num: number;
  expTime: Date | null;
  flowResetTime: number;
  speedId: number | null;
}

export interface Tunnel {
  id: number;
  name: string;
  entryNodeId: number;
  exitNodeId: number;
  entryNodeName?: string;
  exitNodeName?: string;
  status?: number;
  flow?: number; // 流量计算类型
}

export interface SpeedLimit {
  id: number;
  name: string;
  tunnelId: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

export interface ControlServer {
  id: number;
  name: string;
  role: 'master' | 'agent' | string;
  endpoint?: string;
  xuiEndpoint?: string;
  xuiBasePath?: string;
  xuiApiToken?: string;
  xuiUsername?: string;
  xuiPassword?: string;
  xuiTwoFactorCode?: string;
  xuiAllowInsecure?: number;
  xuiLastSync?: number;
  host: string;
  sshPort?: number;
  sshUser?: string;
  apiToken?: string;
  allowInsecure?: number;
  agentVersion?: string;
  xrayVersion?: string;
  snellVersion?: string;
  xuiServiceStatus?: string;
  xrayServiceStatus?: string;
  snellServiceStatus?: string;
  certificateMode?: string;
  certificateDomain?: string;
  certificateStatus?: string;
  certificateExpireAt?: number;
  lastHeartbeat?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  memoryTotalMb?: number;
  lowMemoryMode?: number;
  lowMemoryProfile?: string;
  lowMemoryAdvice?: string;
  uploadTraffic?: number;
  downloadTraffic?: number;
  lastError?: string;
  status: number;
}

export interface ProtocolProfile {
  id: number;
  name: string;
  protocol: string;
  versionFamily?: string;
  listenPort?: number;
  transport?: string;
  remark?: string;
  configJson?: string;
  status: number;
}

export interface ProtocolNode {
  id: number;
  serverId: number;
  serverName?: string;
  name: string;
  protocol: string;
  engine: "xray" | "snell" | string;
  direction: "inbound" | "outbound" | string;
  listen?: string;
  port?: number;
  transport?: string;
  security?: string;
  credentialJson?: string;
  configJson?: string;
  remoteId?: string;
  serviceName?: string;
  state?: string;
  up?: number;
  down?: number;
  total?: number;
  lastSync?: number;
  lastError?: string;
  createdTime?: number;
  status: number;
}

export interface ServerForwardRule {
  id: number;
  serverId: number;
  serverName?: string;
  name: string;
  protocol: "tcp" | "udp" | string;
  listenHost?: string;
  listenPort: number;
  targetHost: string;
  targetPort: number;
  engine?: string;
  serviceName?: string;
  state?: string;
  up?: number;
  down?: number;
  lastSync?: number;
  lastError?: string;
  createdTime?: number;
  status: number;
}

export interface ServerRuleOverview {
  server?: ControlServer;
  protocolNodes?: ProtocolNode[];
  forwardRules?: ServerForwardRule[];
  xuiInbounds?: any;
  xuiOutbounds?: any;
}

export interface RuntimeProviderDescriptor {
  key: string;
  name: string;
  runtimeType: string;
  executor: string;
  stateSource: string;
  summary: string;
  agentRequired: boolean;
  masterApiSupported: boolean;
  nanoSupported: boolean;
  protocols: string[];
  actions: string[];
  capabilities: string[];
  requiredServerFields: string[];
  exposedPorts: string[];
  relatedProviders: string[];
}

export interface RuntimeProviderAssignment {
  key: string;
  name: string;
  protocol: string;
  action: string;
  executor: string;
  stateSource: string;
  agentRequired: boolean;
  masterApiSupported: boolean;
  nanoSupported: boolean;
  capabilities: string[];
  relatedProviders: string[];
}

export interface RuntimeState {
  providerKey?: string;
  providerName?: string;
  protocol?: string;
  action?: string;
  taskState?: string;
  status?: string;
  statusSource?: string;
  serviceStatuses?: Record<string, string>;
  nodeCount?: number;
  forwardRuleCount?: number;
  certificateStatus?: string;
  certificateDomain?: string;
  diagnosticSummary?: {
    ok?: number;
    warning?: number;
    fail?: number;
    total?: number;
  };
  updatedAt?: number;
}

export interface RuntimeStateOverviewItem {
  serverId: number;
  serverName?: string;
  providerKey: string;
  providerName?: string;
  status?: string;
  statusSource?: string;
  protocol?: string;
  action?: string;
  taskState?: string;
  taskId?: number;
  taskUpdatedAt?: number;
  stateUpdatedAt?: number;
  lastHeartbeat?: number;
  lastError?: string;
  serviceStatuses?: Record<string, string>;
  nodeCount?: number;
  forwardRuleCount?: number;
  certificateStatus?: string;
  certificateDomain?: string;
  certificateExpireAt?: number;
  diagnosticSummary?: RuntimeState["diagnosticSummary"];
  source?: "task" | "heartbeat" | string;
}

export interface RuntimeStateOverview {
  generatedAt: number;
  servers: number;
  providers: number;
  healthy: number;
  warning: number;
  failed: number;
  unknown: number;
  items: RuntimeStateOverviewItem[];
}

export interface DeployTask {
  id: number;
  serverId: number;
  serverName?: string;
  protocol: string;
  action: string;
  state: string;
  requestJson?: string;
  script?: string;
  resultJson?: string;
  startedTime?: number;
  finishedTime?: number;
  createdTime?: number;
  runtimeProvider?: RuntimeProviderAssignment;
  status: number;
}

export interface ThreeXuiTrafficSnapshot {
  id: number;
  serverId: number;
  serverName?: string;
  sourceType: "inbound" | "client" | "outbound" | string;
  inboundId?: number;
  inboundRemark?: string;
  protocol?: string;
  tag?: string;
  email?: string;
  clientId?: string;
  up?: number;
  down?: number;
  total?: number;
  expiryTime?: number;
  enable?: number;
  syncedTime?: number;
  rawJson?: string;
  createdTime?: number;
  status: number;
}

export interface MonitorAlert {
  id: number;
  serverId: number;
  serverName?: string;
  alertType: string;
  severity: "warning" | "critical" | string;
  source: string;
  message: string;
  detailJson?: string;
  firstSeenAt?: number;
  lastSeenAt?: number;
  acknowledged?: number;
  acknowledgedTime?: number;
  createdTime?: number;
  status: number;
}

export interface Pagination {
  current: number;
  size: number;
  total: number;
}
