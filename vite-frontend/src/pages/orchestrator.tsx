import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import toast from "react-hot-toast";

import { useLanguage } from "@/i18n";
import {
  acknowledgeMonitorAlert,
  createControlServer,
  createDeployTask,
  createProtocolNode,
  createOrchestrationTask,
  createProtocolProfile,
  createServerForwardRule,
  deleteControlServer,
  deleteDeployTask,
  deleteProtocolNode,
  deleteProtocolProfile,
  deleteServerForwardRule,
  addThreeXuiInbound,
  deleteThreeXuiInbound,
  ensureDefaultProtocolProfiles,
  getControlServerList,
  getControlServerToken,
  getDeployTaskList,
  getDeployTaskScript,
  getRuntimeStateOverview,
  getRuntimeProviderList,
  listMonitorAlerts,
  listOperationAuditLogs,
  getProtocolNodeList,
  getProtocolProfileList,
  getServerForwardRuleList,
  getServerRuleOverview,
  getThreeXuiConfig,
  getThreeXuiOutboundTraffic,
  getThreeXuiOutbounds,
  listThreeXuiTraffic,
  listThreeXuiInbounds,
  rotateControlServerToken,
  restartProtocolNode,
  restartServerForwardRule,
  restartThreeXuiXray,
  retryDeployTask,
  saveThreeXuiOutbounds,
  syncThreeXuiTraffic,
  syncProtocolNodes,
  testThreeXuiConnection,
  updateThreeXuiInbound,
  updateControlServer,
  updateProtocolNode,
  updateProtocolProfile,
  updateServerForwardRule
} from "@/api";
import type { ControlServer, DeployTask, MonitorAlert, OperationAuditLog, ProtocolNode, ProtocolProfile, RuntimeProviderAction, RuntimeProviderDescriptor, RuntimeState, RuntimeStateOverview, RuntimeStateOverviewItem, ServerForwardRule, ThreeXuiTrafficSnapshot } from "@/types";

interface ServerForm {
  id?: number;
  name: string;
  role: string;
  endpoint: string;
  xuiEndpoint: string;
  xuiBasePath: string;
  xuiApiToken: string;
  xuiUsername: string;
  xuiPassword: string;
  xuiTwoFactorCode: string;
  xuiAllowInsecure: number;
  host: string;
  sshPort: number;
  sshUser: string;
  allowInsecure: number;
}

interface ProfileForm {
  id?: number;
  name: string;
  protocol: string;
  versionFamily: string;
  listenPort: number;
  transport: string;
  remark: string;
  configJson: string;
}

interface DeployForm {
  serverId: number | null;
  profileId: number | null;
  protocol: string;
  action: string;
  versionFamily: string;
  exactVersion: string;
  listenPort: number;
  psk: string;
}

interface OrchestrationForm {
  serverId: number | null;
  serverIds: number[];
  installXui: boolean;
  configurePanel: boolean;
  xuiVersion: string;
  panelPort: number;
  panelUsername: string;
  panelPassword: string;
  webBasePath: string;
  publicHost: string;
  listenIp: string;
  certificateMode: "self-signed" | "acme-http" | "none";
  certificateDomain: string;
  acmeEmail: string;
  createVlessReality: boolean;
  createVmessWs: boolean;
  createTrojanTls: boolean;
  createShadowsocks: boolean;
  vlessPort: number;
  vmessPort: number;
  trojanPort: number;
  shadowsocksPort: number;
  realitySni: string;
  realityDest: string;
  wsPath: string;
  ssMethod: string;
  installSnell: boolean;
  snellPort: number;
  snellPsk: string;
}

interface ThreeXuiInboundForm {
  serverId: number | null;
  inboundId: string;
  mode: "add" | "update" | "delete";
  editMode: "form" | "json";
  remark: string;
  enable: number;
  listen: string;
  port: number;
  protocol: "vless" | "vmess" | "trojan" | "shadowsocks";
  network: "tcp" | "ws";
  security: "none" | "tls" | "reality";
  clientEmail: string;
  clientId: string;
  clientPassword: string;
  flow: string;
  totalGb: number;
  expiryDays: number;
  sni: string;
  realityDest: string;
  realityPrivateKey: string;
  realityShortId: string;
  wsPath: string;
  ssMethod: string;
  payloadJson: string;
}

interface ProtocolNodeForm {
  id?: number;
  serverId: number | null;
  name: string;
  protocol: "vless" | "vmess" | "trojan" | "shadowsocks" | "snell";
  engine: "xray" | "snell";
  listen: string;
  port: number;
  transport: "tcp" | "ws";
  security: "none" | "tls" | "reality" | "psk";
  clientEmail: string;
  clientId: string;
  clientPassword: string;
  flow: string;
  totalGb: number;
  expiryDays: number;
  sni: string;
  realityDest: string;
  realityPrivateKey: string;
  realityShortId: string;
  wsPath: string;
  ssMethod: string;
  outboundTag: string;
  snellPsk: string;
  snellVersion: string;
}

interface ServerForwardRuleForm {
  id?: number;
  serverId: number | null;
  name: string;
  protocol: "tcp" | "udp";
  listenHost: string;
  listenPort: number;
  targetHost: string;
  targetPort: number;
}

type RuleKindFilter = "all" | "protocol" | "forward" | "xui";
type RuleHealthFilter = "all" | "healthy" | "warning" | "error";
type RuleHealth = Exclude<RuleHealthFilter, "all">;
type FormCheckState = "ok" | "warning" | "missing";
type DiagnosticState = "ok" | "warning" | "fail";
type StatusColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";
type AgentMaintenanceAction = RuntimeProviderAction | string;

interface PendingAgentMaintenance {
  server: ControlServer;
  actionKey: string;
  actionText: string;
  actionMeta?: RuntimeProviderAction;
  meta: Record<string, unknown>;
}

interface PendingUiConfirmation {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  color?: StatusColor;
  testId?: string;
  onConfirm: () => Promise<void> | void;
}

const fallbackAction = (
  key: string,
  label: string,
  category: RuntimeProviderAction["category"],
  providerKey: string,
  danger = false,
  primary = true,
  stateSync = false
): RuntimeProviderAction => ({
  key,
  label,
  category,
  protocol: "agent-maintenance",
  providerKey,
  danger,
  primary,
  stateSync
});

const FALLBACK_AGENT_MAINTENANCE_ACTIONS: RuntimeProviderAction[] = [
  fallbackAction("doctor", "诊断", "diagnostic", "xui", false, true, false),
  fallbackAction("status", "状态", "diagnostic", "xui", false, false, false),
  fallbackAction("logs", "日志", "diagnostic", "xui", false, true, false),
  fallbackAction("install-diagnose", "安装诊断", "diagnostic", "xui", false, true, true),
  fallbackAction("cert-diagnose", "证书诊断", "diagnostic", "certificate", false, true, true),
  fallbackAction("firewall-diagnose", "防火墙诊断", "diagnostic", "firewall", false, true, true),
  fallbackAction("firewall-diagnose", "防火墙诊断", "diagnostic", "forward", false, true, true),
  fallbackAction("repair-all", "一键修复", "repair", "xui", false, true, false),
  fallbackAction("repair-xui", "修复 Xray 面板", "repair", "xui", false, true, true),
  fallbackAction("repair-xray", "修复 Xray", "repair", "xui", false, true, true),
  fallbackAction("repair-snell", "修复 Snell", "repair", "snell", false, true, true),
  fallbackAction("restart-agent", "重启 agent", "maintenance", "xui"),
  fallbackAction("upgrade-agent", "升级 agent", "maintenance", "xui"),
  fallbackAction("uninstall-agent", "卸载 agent", "danger", "xui", true, false, false)
];

const AGENT_ACTION_ORDER = [
  "doctor",
  "logs",
  "install-diagnose",
  "cert-diagnose",
  "firewall-diagnose",
  "repair-all",
  "repair-xui",
  "repair-xray",
  "repair-snell",
  "restart-agent",
  "upgrade-agent",
  "uninstall-agent",
  "status"
];

const actionOrderIndex = (key?: string) => {
  const index = AGENT_ACTION_ORDER.indexOf(key || "");
  return index >= 0 ? index : AGENT_ACTION_ORDER.length;
};

const runtimeProviderStatusNeedsRepair = (status?: string) => {
  if (!status) return false;
  return ["failed", "fail", "error", "danger", "missing", "timeout", "inactive", "expired", "unreadable", "offline"].includes(status.toLowerCase());
};

const sortRuntimeProviderActions = (actions: RuntimeProviderAction[]) => {
  return [...actions].sort((left, right) => {
    const orderDelta = actionOrderIndex(left.key) - actionOrderIndex(right.key);
    return orderDelta !== 0 ? orderDelta : left.key.localeCompare(right.key);
  });
};

const mergeProviderActions = (runtimeProviders: RuntimeProviderDescriptor[]) => {
  const actions = new Map<string, RuntimeProviderAction>();
  for (const action of FALLBACK_AGENT_MAINTENANCE_ACTIONS) {
    actions.set(`${action.providerKey}:${action.key}`, action);
  }
  for (const provider of runtimeProviders) {
    for (const action of provider.actionCatalog || []) {
      if (action.protocol === "agent-maintenance" && action.key) {
        actions.set(`${action.providerKey || provider.key}:${action.key}`, { ...action, providerKey: action.providerKey || provider.key });
      }
    }
  }
  return sortRuntimeProviderActions(Array.from(actions.values()));
};

const dedupeActionsByKey = (actions: RuntimeProviderAction[]) => {
  const byKey = new Map<string, RuntimeProviderAction>();
  for (const action of actions) {
    if (!byKey.has(action.key) || action.providerKey !== "xui") {
      byKey.set(action.key, action);
    }
  }
  return sortRuntimeProviderActions(Array.from(byKey.values()));
};

const runtimeProviderActionColor = (action: RuntimeProviderAction): StatusColor => {
  if (action.danger || action.category === "danger") return "danger";
  if (action.category === "repair" || action.category === "maintenance") return "warning";
  return "default";
};

const actionLabel = (action: RuntimeProviderAction | string, actions: RuntimeProviderAction[]) => {
  if (typeof action !== "string") {
    return action.label || action.key;
  }
  return actions.find(item => item.key === action)?.label
    || FALLBACK_AGENT_MAINTENANCE_ACTIONS.find(item => item.key === action)?.label
    || action;
};

const findProviderAction = (actions: RuntimeProviderAction[], providerKey: string | undefined, key: string) => {
  return actions.find(action => action.providerKey === providerKey && action.key === key)
    || actions.find(action => action.key === key);
};

const runtimeProviderDiagnosticAction = (item: RuntimeStateOverviewItem | undefined, actions: RuntimeProviderAction[]): RuntimeProviderAction => {
  const providerKey = item?.providerKey;
  if (providerKey === "xui") {
    return findProviderAction(actions, providerKey, "install-diagnose")
      || findProviderAction(actions, providerKey, "doctor")
      || FALLBACK_AGENT_MAINTENANCE_ACTIONS[0];
  }
  const providerDiagnostic = actions.find(action =>
    action.providerKey === providerKey &&
    action.category === "diagnostic" &&
    action.stateSync
  );
  return providerDiagnostic
    || findProviderAction(actions, providerKey, "doctor")
    || FALLBACK_AGENT_MAINTENANCE_ACTIONS[0];
};

const runtimeProviderRepairAction = (item: RuntimeStateOverviewItem | undefined, actions: RuntimeProviderAction[]): RuntimeProviderAction | null => {
  if (item?.providerKey === "xui") {
    return runtimeProviderStatusNeedsRepair(item.serviceStatuses?.xray)
      ? findProviderAction(actions, item.providerKey, "repair-xray") || null
      : findProviderAction(actions, item.providerKey, "repair-xui") || null;
  }
  return actions.find(action =>
    action.providerKey === item?.providerKey &&
    action.category === "repair" &&
    action.stateSync
  ) || null;
};

interface UnifiedRuleRow {
  id: string;
  kind: Exclude<RuleKindFilter, "all">;
  title: string;
  serverId?: number;
  serverName: string;
  protocol: string;
  endpoint: string;
  target: string;
  status: string;
  health: RuleHealth;
  port?: number;
  traffic: number;
  syncedAt?: number;
  detail: string;
  error?: string;
  node?: ProtocolNode;
  rule?: ServerForwardRule;
  snapshot?: ThreeXuiTrafficSnapshot;
}

interface FormCheck {
  label: string;
  detail: string;
  state: FormCheckState;
}

interface DiagnosticItem {
  state: DiagnosticState;
  code: string;
  title: string;
  detail?: string;
  hint?: string;
}

interface DiagnosticSummary {
  ok: number;
  warning: number;
  fail: number;
  total: number;
}

interface RemoteLogItem {
  runtime: string;
  source: string;
  title: string;
  content: string;
  lines: number;
  truncated: boolean;
}

interface AgentUpgradeInfo {
  sourceUrl: string;
  agentBinary: string;
  backupPath: string;
  previousVersion: string;
  newVersion: string;
  checksumSha256: string;
  syntaxChecked: boolean;
  installed: boolean;
  restartScheduled: boolean;
  reportedAt?: number;
  parseError?: string;
}

const NANO_MEMORY_MB = 256;
const NANO_CRITICAL_MEMORY_MB = 200;

const blankServerForm: ServerForm = {
  name: "",
  role: "agent",
  endpoint: "",
  xuiEndpoint: "",
  xuiBasePath: "",
  xuiApiToken: "",
  xuiUsername: "",
  xuiPassword: "",
  xuiTwoFactorCode: "",
  xuiAllowInsecure: 0,
  host: "",
  sshPort: 22,
  sshUser: "root",
  allowInsecure: 0
};

const blankProfileForm: ProfileForm = {
  name: "",
  protocol: "snell",
  versionFamily: "v4",
  listenPort: 8388,
  transport: "tcp",
  remark: "",
  configJson: "{\"dns\":{\"mode\":\"system\"},\"firewall\":{\"enabled\":false}}"
};

const blankDeployForm: DeployForm = {
  serverId: null,
  profileId: null,
  protocol: "snell",
  action: "present",
  versionFamily: "v4",
  exactVersion: "v4.1.1",
  listenPort: 8388,
  psk: ""
};

const blankOrchestrationForm: OrchestrationForm = {
  serverId: null,
  serverIds: [],
  installXui: true,
  configurePanel: true,
  xuiVersion: "",
  panelPort: 5168,
  panelUsername: "",
  panelPassword: "",
  webBasePath: "ob-control",
  publicHost: "",
  listenIp: "0.0.0.0",
  certificateMode: "self-signed",
  certificateDomain: "",
  acmeEmail: "",
  createVlessReality: true,
  createVmessWs: true,
  createTrojanTls: false,
  createShadowsocks: true,
  vlessPort: 443,
  vmessPort: 2086,
  trojanPort: 8443,
  shadowsocksPort: 8388,
  realitySni: "www.cloudflare.com",
  realityDest: "www.cloudflare.com:443",
  wsPath: "/ws",
  ssMethod: "2022-blake3-aes-128-gcm",
  installSnell: true,
  snellPort: 8390,
  snellPsk: ""
};

const defaultInboundPayload = {
  up: 0,
  down: 0,
  total: 0,
  remark: "ob-vless",
  enable: true,
  expiryTime: 0,
  listen: "",
  port: 443,
  protocol: "vless",
  settings: "{\"clients\":[{\"id\":\"replace-with-uuid\",\"flow\":\"xtls-rprx-vision\",\"email\":\"user@example.com\",\"limitIp\":0,\"totalGB\":0,\"expiryTime\":0,\"enable\":true,\"tgId\":0,\"subId\":\"\",\"comment\":\"\",\"reset\":0}],\"decryption\":\"none\",\"fallbacks\":[]}",
  streamSettings: "{\"network\":\"tcp\",\"security\":\"reality\",\"realitySettings\":{\"show\":false,\"dest\":\"www.cloudflare.com:443\",\"xver\":0,\"serverNames\":[\"www.cloudflare.com\"],\"privateKey\":\"replace-private-key\",\"shortIds\":[\"\"]}}",
  sniffing: "{\"enabled\":true,\"destOverride\":[\"http\",\"tls\",\"quic\",\"fakedns\"]}"
};

const blankThreeXuiInboundForm: ThreeXuiInboundForm = {
  serverId: null,
  inboundId: "",
  mode: "add",
  editMode: "form",
  remark: "ob-vless",
  enable: 1,
  listen: "",
  port: 443,
  protocol: "vless",
  network: "tcp",
  security: "reality",
  clientEmail: "user@example.com",
  clientId: "replace-with-uuid",
  clientPassword: "replace-with-password",
  flow: "xtls-rprx-vision",
  totalGb: 0,
  expiryDays: 0,
  sni: "www.cloudflare.com",
  realityDest: "www.cloudflare.com:443",
  realityPrivateKey: "replace-private-key",
  realityShortId: "",
  wsPath: "/ws",
  ssMethod: "2022-blake3-aes-128-gcm",
  payloadJson: JSON.stringify(defaultInboundPayload, null, 2)
};

const blankProtocolNodeForm: ProtocolNodeForm = {
  serverId: null,
  name: "ob-vless",
  protocol: "vless",
  engine: "xray",
  listen: "",
  port: 443,
  transport: "tcp",
  security: "reality",
  clientEmail: "user@example.com",
  clientId: "replace-with-uuid",
  clientPassword: "replace-with-password",
  flow: "xtls-rprx-vision",
  totalGb: 0,
  expiryDays: 0,
  sni: "www.cloudflare.com",
  realityDest: "www.cloudflare.com:443",
  realityPrivateKey: "replace-private-key",
  realityShortId: "",
  wsPath: "/ws",
  ssMethod: "2022-blake3-aes-128-gcm",
  outboundTag: "",
  snellPsk: "",
  snellVersion: "v4.1.1"
};

const blankServerForwardRuleForm: ServerForwardRuleForm = {
  serverId: null,
  name: "remote-forward",
  protocol: "tcp",
  listenHost: "0.0.0.0",
  listenPort: 10000,
  targetHost: "127.0.0.1",
  targetPort: 80
};

const GB = 1024 * 1024 * 1024;
const DEFAULT_OUTBOUND_TAGS = ["direct", "block", "dns"];

const uniqueStrings = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));

const randomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  return bytes.map(() => Math.floor(Math.random() * 256));
};

const randomHex = (length: number) => Array.from(randomBytes(length))
  .map(byte => byte.toString(16).padStart(2, "0"))
  .join("");

const randomToken = (length = 32) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_";
  return Array.from(randomBytes(length))
    .map(byte => alphabet[byte % alphabet.length])
    .join("");
};

const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...Array.from(bytes)))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/g, "");

const randomRealityPrivateKey = () => base64Url(randomBytes(32));

const randomUuid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const hex = randomHex(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
};

const safeJsonParse = (value?: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const parseEmbeddedAgentResult = (stdout?: string) => {
  if (!stdout) return null;
  const marker = "OB_AGENT_RESULT_JSON=";
  const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].startsWith(marker)) {
      return safeJsonParse(lines[index].slice(marker.length));
    }
  }
  return null;
};

const deployTaskResultPayload = (task: DeployTask) => {
  const parsed = safeJsonParse(task.resultJson);
  if (!parsed || typeof parsed !== "object") return null;
  if ((parsed as any).diagnostics) return parsed;
  if (typeof (parsed as any).resultJson === "string") {
    const nested = safeJsonParse((parsed as any).resultJson);
    if (nested) return nested;
  }
  return parseEmbeddedAgentResult((parsed as any).stdout) || parsed;
};

const taskRuntimeState = (task: DeployTask): RuntimeState | null => {
  const parsed = safeJsonParse(task.resultJson);
  const directState = parsed && typeof parsed === "object" ? (parsed as any).runtimeState : null;
  if (directState && typeof directState === "object" && !Array.isArray(directState)) {
    return directState as RuntimeState;
  }
  const payload = deployTaskResultPayload(task);
  const runtimeState = (payload as any)?.runtimeState;
  return runtimeState && typeof runtimeState === "object" && !Array.isArray(runtimeState)
    ? runtimeState as RuntimeState
    : null;
};

const normalizeDiagnosticState = (value: unknown): DiagnosticState => {
  const normalized = String(value || "").toLowerCase();
  if (["ok", "success", "succeeded", "pass", "passed"].includes(normalized)) return "ok";
  if (["fail", "failed", "error", "danger", "missing"].includes(normalized)) return "fail";
  return "warning";
};

const taskDiagnostics = (task: DeployTask): DiagnosticItem[] => {
  const payload = deployTaskResultPayload(task);
  const items = (payload as any)?.diagnostics?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => item && typeof item === "object")
    .map(item => ({
      state: normalizeDiagnosticState((item as any).state),
      code: String((item as any).code || "unknown"),
      title: String((item as any).title || (item as any).code || "diagnostic"),
      detail: String((item as any).detail || ""),
      hint: String((item as any).hint || "")
    }));
};

const taskRemoteLogs = (task: DeployTask): RemoteLogItem[] => {
  const payload = deployTaskResultPayload(task);
  const items = (payload as any)?.logs?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => item && typeof item === "object")
    .map(item => {
      const content = String((item as any).content || "");
      const lines = Number((item as any).lines);
      return {
        runtime: String((item as any).runtime || "agent"),
        source: String((item as any).source || ""),
        title: String((item as any).title || (item as any).source || "log"),
        content,
        lines: Number.isFinite(lines) ? lines : content.split(/\r?\n/).filter(Boolean).length,
        truncated: Boolean((item as any).truncated)
      };
    });
};

const taskAgentUpgrade = (task: DeployTask): AgentUpgradeInfo | null => {
  const payload = deployTaskResultPayload(task);
  const upgrade = (payload as any)?.maintenance?.upgrade;
  if (!upgrade || typeof upgrade !== "object" || Array.isArray(upgrade)) return null;
  return {
    sourceUrl: String((upgrade as any).sourceUrl || ""),
    agentBinary: String((upgrade as any).agentBinary || ""),
    backupPath: String((upgrade as any).backupPath || ""),
    previousVersion: String((upgrade as any).previousVersion || ""),
    newVersion: String((upgrade as any).newVersion || ""),
    checksumSha256: String((upgrade as any).checksumSha256 || ""),
    syntaxChecked: Boolean((upgrade as any).syntaxChecked),
    installed: Boolean((upgrade as any).installed),
    restartScheduled: Boolean((upgrade as any).restartScheduled),
    reportedAt: Number((upgrade as any).reportedAt) || undefined,
    parseError: (upgrade as any).parseError ? String((upgrade as any).parseError) : undefined
  };
};

const summarizeDiagnostics = (items: DiagnosticItem[]): DiagnosticSummary => ({
  ok: items.filter(item => item.state === "ok").length,
  warning: items.filter(item => item.state === "warning").length,
  fail: items.filter(item => item.state === "fail").length,
  total: items.length
});

const diagnosticTitleByCode: Record<string, string> = {
  dns_domain_missing: "DNS 未配置",
  dns_unresolved: "DNS 未解析",
  dns_resolved: "DNS 已解析",
  dns_public_ip_match: "DNS 指向本机公网 IP",
  dns_public_ip_mismatch: "DNS 未指向本机公网 IP",
  public_ip_unknown: "无法探测本机公网 IP",
  port_80_occupied: "80 端口被占用",
  port_80_free: "80 端口本机未占用",
  port_check_tool_missing: "无法检查端口占用",
  cloud_firewall_check: "云防火墙需确认",
  firewall_tool_missing: "无法读取本机防火墙规则",
  certificate_domain_missing: "证书域名缺失",
  certificate_domain: "证书域名已配置",
  certificate_file_found: "证书文件存在",
  certificate_file_missing: "未找到本机证书文件",
  acme_sh_present: "检测到 acme.sh",
  acme_sh_missing: "未检测到 acme.sh",
  certbot_present: "检测到 certbot",
  certbot_missing: "未检测到 certbot",
  diagnostics_parse_error: "诊断结果解析失败"
};

const collectOutboundTags = (value: any): string[] => {
  if (!value) return [];
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return uniqueStrings(parsed.flatMap(item => collectOutboundTags(item)));
  }
  if (typeof parsed !== "object") return [];

  const directTags = Array.isArray(parsed.outbounds)
    ? parsed.outbounds.map((item: any) => item?.tag).filter((tag: any): tag is string => typeof tag === "string")
    : [];
  const wrappedTags = collectOutboundTags(parsed.obj || parsed.data || parsed.settings);

  return uniqueStrings([...directTags, ...wrappedTags]);
};

const withOutboundTag = (payload: any, outboundTag: string) => {
  const tag = outboundTag.trim();
  return tag ? { ...payload, outboundTag: tag } : payload;
};

const isPlaceholderValue = (value?: string) => {
  const normalized = (value || "").trim().toLowerCase();
  return !normalized || normalized.includes("replace-") || normalized === "password" || normalized === "psk";
};

const protocolNodePayloadPreview = (form: ProtocolNodeForm) => JSON.stringify(
  withOutboundTag(buildInboundPayloadFromForm(inboundFormFromNodeForm(form)), form.outboundTag),
  null,
  2
);

const isLowMemoryServer = (server?: ControlServer) => {
  if (!server) return false;
  if (server.lowMemoryMode === 1) return true;
  return typeof server.memoryTotalMb === "number" && server.memoryTotalMb > 0 && server.memoryTotalMb < NANO_MEMORY_MB;
};

const isNanoCriticalServer = (server?: ControlServer) => {
  return Boolean(server?.memoryTotalMb && server.memoryTotalMb > 0 && server.memoryTotalMb < NANO_CRITICAL_MEMORY_MB);
};

const orchestrationUsesFullXuiStack = (form: OrchestrationForm) => {
  return form.installXui
    || form.configurePanel
    || form.createVlessReality
    || form.createVmessWs
    || form.createTrojanTls
    || form.createShadowsocks;
};

const MasterRiskNotice = ({ context }: { context: string }) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-small border border-warning-300 bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
      <span className="font-semibold">{t("主控高风险：")}</span>{t("{context}会作用在控制面服务器上，建议确认 API、Xray 运行时以及证书任务不会影响现有编排。", { context: t(context) })}
    </div>
  );
};

const ServerActionGroup = ({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-small border border-default-200 bg-white/60 p-2.5 dark:bg-default-50/5" data-testid={testId}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-normal text-gray-500">{t(title)}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
        {children}
      </div>
    </div>
  );
};

const diagnosticColor = (state: DiagnosticState) => {
  if (state === "ok") return "success";
  if (state === "fail") return "danger";
  return "warning";
};

const runtimeStateColor = (status?: string): StatusColor => {
  if (!status) return "default";
  const normalized = status.toLowerCase();
  if (["active", "valid", "running", "healthy", "ok", "success", "succeeded", "synced"].includes(normalized)) return "success";
  if (["mixed", "warning", "expiring", "unknown", "not-installed", "pending", "generated", "claimed"].includes(normalized)) return "warning";
  return "danger";
};

const runtimeProviderColor = (key?: string) => {
  if (key === "xui") return "primary";
  if (key === "snell") return "secondary";
  if (key === "forward") return "success";
  if (key === "certificate") return "warning";
  if (key === "firewall") return "danger";
  return "default";
};

const diagnosticLabel = (state: DiagnosticState, t: (message: string, params?: Record<string, string | number>) => string) => {
  if (state === "ok") return t("正常");
  if (state === "fail") return t("异常");
  return t("提醒");
};

const RuntimeStatePanel = ({ task }: { task: DeployTask }) => {
  const { t } = useLanguage();
  const state = taskRuntimeState(task);
  if (!state) return null;

  const serviceEntries = Object.entries(state.serviceStatuses || {}).filter(([, value]) => value);
  const diagnostic = state.diagnosticSummary;
  const nodeCount = typeof state.nodeCount === "number" ? state.nodeCount : null;
  const forwardRuleCount = typeof state.forwardRuleCount === "number" ? state.forwardRuleCount : null;
  const certificateText = [state.certificateStatus, state.certificateDomain].filter(Boolean).join(" ");

  return (
    <div className="rounded-small border border-default-200 bg-default-50/70 p-3 text-xs dark:bg-default-100/5">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("运行时状态")}</p>
          <p className="truncate text-xs text-gray-500">
            {state.providerName || state.providerKey || task.runtimeProvider?.name || task.protocol} · {state.protocol || task.protocol} / {state.action || task.action}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {state.providerKey && <Chip size="sm" variant="flat">{state.providerKey}</Chip>}
          <Chip size="sm" variant="flat" color={runtimeStateColor(state.status) as any}>{state.status || state.taskState || "-"}</Chip>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-gray-500">{t("来源")}</p>
          <p className="truncate font-medium text-gray-900 dark:text-white">{state.statusSource || "-"}</p>
        </div>
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-gray-500">{t("节点")}</p>
          <p className="font-medium text-gray-900 dark:text-white">{nodeCount ?? "-"}</p>
        </div>
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-gray-500">{t("转发")}</p>
          <p className="font-medium text-gray-900 dark:text-white">{forwardRuleCount ?? "-"}</p>
        </div>
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-gray-500">{t("证书")}</p>
          <p className="truncate font-medium text-gray-900 dark:text-white">{certificateText || "-"}</p>
        </div>
      </div>
      {(serviceEntries.length > 0 || diagnostic) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {serviceEntries.map(([name, status]) => (
            <Chip key={name} size="sm" variant="flat" color={runtimeStateColor(status) as any}>
              {name} {status}
            </Chip>
          ))}
          {diagnostic && (
            <Chip size="sm" variant="flat" color={(diagnostic.fail || 0) > 0 ? "danger" : (diagnostic.warning || 0) > 0 ? "warning" : "success"}>
              {t("诊断 {fail}/{warning}/{ok}", {
                fail: diagnostic.fail || 0,
                warning: diagnostic.warning || 0,
                ok: diagnostic.ok || 0
              })}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
};

const DiagnosticSummaryPanel = ({ task, onShowResult }: { task: DeployTask; onShowResult: (task: DeployTask) => void }) => {
  const { t } = useLanguage();
  const diagnostics = taskDiagnostics(task);
  if (!diagnostics.length) return null;

  const summary = summarizeDiagnostics(diagnostics);
  const visibleItems = [...diagnostics]
    .sort((left, right) => {
      const weight: Record<DiagnosticState, number> = { fail: 0, warning: 1, ok: 2 };
      return weight[left.state] - weight[right.state];
    })
    .slice(0, 5);

  return (
    <div className="rounded-small border border-default-200 bg-default-50/70 p-3 dark:bg-default-100/5">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("诊断摘要")}</p>
          <p className="text-xs text-gray-500">{t("ACME、DNS、80 端口、防火墙和证书线索会在这里汇总。")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip size="sm" variant="flat" color={summary.fail > 0 ? "danger" : "default"}>{t("{count} 异常", { count: summary.fail })}</Chip>
          <Chip size="sm" variant="flat" color={summary.warning > 0 ? "warning" : "default"}>{t("{count} 提醒", { count: summary.warning })}</Chip>
          <Chip size="sm" variant="flat" color="success">{t("{count} 正常", { count: summary.ok })}</Chip>
        </div>
      </div>
      <div className="space-y-2">
        {visibleItems.map(item => (
          <div key={`${item.code}-${item.title}`} className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t(diagnosticTitleByCode[item.code] || item.title)}</p>
                {item.detail && <p className="mt-1 break-words text-xs leading-5 text-gray-500">{item.detail}</p>}
                {item.hint && <p className="mt-1 break-words text-xs leading-5 text-gray-600 dark:text-gray-300">{item.hint}</p>}
              </div>
              <Chip size="sm" variant="flat" color={diagnosticColor(item.state) as any}>{diagnosticLabel(item.state, t)}</Chip>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">{t("仅展示最需要处理的前 {count} 条，完整细节保留在原始结果里。", { count: visibleItems.length })}</p>
        <Button size="sm" variant="light" onPress={() => onShowResult(task)}>{t("查看原始结果")}</Button>
      </div>
    </div>
  );
};

const RemoteLogsPanel = ({ task, onShowResult }: { task: DeployTask; onShowResult: (task: DeployTask) => void }) => {
  const { t } = useLanguage();
  const logs = taskRemoteLogs(task);
  if (!logs.length) return null;

  const visibleLogs = logs.slice(0, 4);
  const runtimes = Array.from(new Set(logs.map(item => item.runtime).filter(Boolean)));

  return (
    <div className="rounded-small border border-default-200 bg-default-50/70 p-3 dark:bg-default-100/5">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("远端日志")}</p>
          <p className="truncate text-xs text-gray-500">{t("Agent 回传的运行时日志片段，完整内容保留在原始结果里。")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip size="sm" variant="flat">{t("{count} 份日志", { count: logs.length })}</Chip>
          {runtimes.slice(0, 4).map(runtime => (
            <Chip key={runtime} size="sm" variant="flat" color={runtimeProviderColor(runtime) as any}>{runtime}</Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {visibleLogs.map((item, index) => {
          const preview = item.content.split(/\r?\n/).filter(Boolean).slice(-3).join("\n");
          return (
            <div key={`${item.runtime}-${item.source}-${index}`} className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.title || item.source || item.runtime}</p>
                  <p className="truncate text-[11px] text-gray-500">{item.source || item.runtime}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Chip size="sm" variant="flat">{t("{count} 行", { count: item.lines })}</Chip>
                  {item.truncated && <Chip size="sm" variant="flat" color="warning">{t("已截断")}</Chip>}
                </div>
              </div>
              {preview && <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap break-words rounded-small bg-default-100/70 p-2 font-mono text-[11px] leading-4 text-gray-600 dark:bg-default-50/10 dark:text-gray-300">{preview}</pre>}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">{t("仅展示最近 {count} 份日志摘要。", { count: visibleLogs.length })}</p>
        <Button size="sm" variant="light" onPress={() => onShowResult(task)}>{t("查看完整日志")}</Button>
      </div>
    </div>
  );
};

const AgentUpgradePanel = ({ task, onShowResult }: { task: DeployTask; onShowResult: (task: DeployTask) => void }) => {
  const { t } = useLanguage();
  const upgrade = taskAgentUpgrade(task);
  if (!upgrade) return null;

  const checksumPreview = upgrade.checksumSha256
    ? `${upgrade.checksumSha256.slice(0, 12)}...${upgrade.checksumSha256.slice(-8)}`
    : "-";

  return (
    <div className="rounded-small border border-default-200 bg-default-50/70 p-3 dark:bg-default-100/5">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("Agent 升级")}</p>
          <p className="truncate text-xs text-gray-500">{upgrade.previousVersion || "-"} -&gt; {upgrade.newVersion || "-"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip size="sm" variant="flat" color={upgrade.syntaxChecked ? "success" : "danger"}>{upgrade.syntaxChecked ? t("语法已校验") : t("语法未校验")}</Chip>
          <Chip size="sm" variant="flat" color={upgrade.installed ? "success" : "danger"}>{upgrade.installed ? t("已安装") : t("未安装")}</Chip>
          <Chip size="sm" variant="flat" color={upgrade.restartScheduled ? "primary" : "warning"}>{upgrade.restartScheduled ? t("重启已计划") : t("需手动重启")}</Chip>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-xs text-gray-500">{t("Agent 文件")}</p>
          <p className="truncate text-xs font-medium text-gray-900 dark:text-white">{upgrade.agentBinary || "-"}</p>
        </div>
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-xs text-gray-500">{t("备份")}</p>
          <p className="truncate text-xs font-medium text-gray-900 dark:text-white">{upgrade.backupPath || "-"}</p>
        </div>
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-xs text-gray-500">SHA256</p>
          <p className="truncate font-mono text-xs text-gray-900 dark:text-white">{checksumPreview}</p>
        </div>
        <div className="rounded-small border border-default-200 bg-white px-2.5 py-2 dark:bg-default-50/5">
          <p className="text-xs text-gray-500">{t("来源")}</p>
          <p className="truncate text-xs font-medium text-gray-900 dark:text-white">{upgrade.sourceUrl || "-"}</p>
        </div>
      </div>
      {upgrade.parseError && <p className="mt-2 text-xs text-danger">{upgrade.parseError}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">{t("升级结果会保留版本、校验、备份和重启计划。")}</p>
        <Button size="sm" variant="light" onPress={() => onShowResult(task)}>{t("查看原始结果")}</Button>
      </div>
    </div>
  );
};

const asExpiryTime = (days: number) => {
  if (!days || days <= 0) return 0;
  return Date.now() + days * 24 * 60 * 60 * 1000;
};

const asTrafficLimit = (gb: number) => {
  if (!gb || gb <= 0) return 0;
  return Math.round(gb * GB);
};

const clientBase = (form: ThreeXuiInboundForm) => ({
  email: form.clientEmail.trim(),
  limitIp: 0,
  totalGB: asTrafficLimit(form.totalGb),
  expiryTime: asExpiryTime(form.expiryDays),
  enable: form.enable === 1,
  tgId: "",
  subId: "",
  comment: "",
  reset: 0
});

const buildInboundPayloadFromForm = (form: ThreeXuiInboundForm) => {
  const protocol = form.protocol;
  const sniffing = {
    enabled: true,
    destOverride: ["http", "tls", "quic", "fakedns"]
  };
  let settings: Record<string, any> = {};
  let streamSettings: Record<string, any> = {
    network: form.network,
    security: form.security
  };

  if (protocol === "vless") {
    settings = {
      clients: [{
        ...clientBase(form),
        id: form.clientId.trim(),
        flow: form.security === "reality" ? form.flow : ""
      }],
      decryption: "none",
      fallbacks: []
    };
    streamSettings = {
      network: "tcp",
      security: form.security,
      realitySettings: form.security === "reality" ? {
        show: false,
        dest: form.realityDest.trim(),
        xver: 0,
        serverNames: [form.sni.trim()].filter(Boolean),
        privateKey: form.realityPrivateKey.trim(),
        shortIds: [form.realityShortId.trim()]
      } : undefined,
      tlsSettings: form.security === "tls" ? {
        serverName: form.sni.trim()
      } : undefined
    };
  }

  if (protocol === "vmess") {
    settings = {
      clients: [{
        ...clientBase(form),
        id: form.clientId.trim(),
        alterId: 0
      }],
      disableInsecureEncryption: false
    };
    streamSettings = {
      network: "ws",
      security: form.security === "tls" ? "tls" : "none",
      wsSettings: {
        path: form.wsPath.trim() || "/ws",
        headers: form.sni.trim() ? { Host: form.sni.trim() } : {}
      },
      tlsSettings: form.security === "tls" ? {
        serverName: form.sni.trim()
      } : undefined
    };
  }

  if (protocol === "trojan") {
    settings = {
      clients: [{
        ...clientBase(form),
        password: form.clientPassword.trim()
      }],
      fallbacks: []
    };
    streamSettings = {
      network: "tcp",
      security: form.security === "none" ? "tls" : form.security,
      tlsSettings: {
        serverName: form.sni.trim()
      }
    };
  }

  if (protocol === "shadowsocks") {
    settings = {
      method: form.ssMethod.trim(),
      password: form.clientPassword.trim(),
      network: "tcp,udp"
    };
    streamSettings = {
      network: "tcp",
      security: "none"
    };
  }

  const cleanStreamSettings = JSON.parse(JSON.stringify(streamSettings));

  return {
    up: 0,
    down: 0,
    total: 0,
    remark: form.remark.trim() || `ob-${protocol}`,
    enable: form.enable === 1,
    expiryTime: 0,
    listen: form.listen.trim(),
    port: Number(form.port) || 443,
    protocol,
    settings: JSON.stringify(settings),
    streamSettings: JSON.stringify(cleanStreamSettings),
    sniffing: JSON.stringify(sniffing)
  };
};

const inboundPayloadPreview = (form: ThreeXuiInboundForm) => JSON.stringify(buildInboundPayloadFromForm(form), null, 2);

const inboundFormFromNodeForm = (form: ProtocolNodeForm): ThreeXuiInboundForm => ({
  ...blankThreeXuiInboundForm,
  serverId: form.serverId,
  remark: form.name,
  listen: form.listen,
  port: form.port,
  protocol: form.protocol === "snell" ? "vless" : form.protocol,
  network: form.transport === "ws" ? "ws" : "tcp",
  security: form.security === "psk" ? "none" : form.security,
  clientEmail: form.clientEmail,
  clientId: form.clientId,
  clientPassword: form.clientPassword,
  flow: form.flow,
  totalGb: form.totalGb,
  expiryDays: form.expiryDays,
  sni: form.sni,
  realityDest: form.realityDest,
  realityPrivateKey: form.realityPrivateKey,
  realityShortId: form.realityShortId,
  wsPath: form.wsPath,
  ssMethod: form.ssMethod
});

export default function OrchestratorPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState<ControlServer[]>([]);
  const [protocolNodes, setProtocolNodes] = useState<ProtocolNode[]>([]);
  const [forwardRules, setForwardRules] = useState<ServerForwardRule[]>([]);
  const [profiles, setProfiles] = useState<ProtocolProfile[]>([]);
  const [tasks, setTasks] = useState<DeployTask[]>([]);
  const [runtimeProviders, setRuntimeProviders] = useState<RuntimeProviderDescriptor[]>([]);
  const [runtimeStateOverview, setRuntimeStateOverview] = useState<RuntimeStateOverview | null>(null);
  const [trafficSnapshots, setTrafficSnapshots] = useState<ThreeXuiTrafficSnapshot[]>([]);
  const [monitorAlerts, setMonitorAlerts] = useState<MonitorAlert[]>([]);
  const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([]);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [protocolNodeModalOpen, setProtocolNodeModalOpen] = useState(false);
  const [serverForwardModalOpen, setServerForwardModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [orchestrationModalOpen, setOrchestrationModalOpen] = useState(false);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [threeXuiInboundModalOpen, setThreeXuiInboundModalOpen] = useState(false);
  const [xraySettingModalOpen, setXraySettingModalOpen] = useState(false);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [pendingAgentMaintenance, setPendingAgentMaintenance] = useState<PendingAgentMaintenance | null>(null);
  const [pendingUiConfirmation, setPendingUiConfirmation] = useState<PendingUiConfirmation | null>(null);
  const [xraySettingServerId, setXraySettingServerId] = useState<number | null>(null);
  const [xraySettingText, setXraySettingText] = useState("");
  const [outboundTestUrl, setOutboundTestUrl] = useState("https://www.google.com/generate_204");
  const [outboundTagHints, setOutboundTagHints] = useState<string[]>(DEFAULT_OUTBOUND_TAGS);
  const [protocolNodePreviewOpen, setProtocolNodePreviewOpen] = useState(false);
  const [serverForm, setServerForm] = useState<ServerForm>(blankServerForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(blankProfileForm);
  const [protocolNodeForm, setProtocolNodeForm] = useState<ProtocolNodeForm>(blankProtocolNodeForm);
  const [serverForwardRuleForm, setServerForwardRuleForm] = useState<ServerForwardRuleForm>(blankServerForwardRuleForm);
  const [deployForm, setDeployForm] = useState<DeployForm>(blankDeployForm);
  const [orchestrationForm, setOrchestrationForm] = useState<OrchestrationForm>(blankOrchestrationForm);
  const [threeXuiInboundForm, setThreeXuiInboundForm] = useState<ThreeXuiInboundForm>(blankThreeXuiInboundForm);
  const [ruleSearch, setRuleSearch] = useState("");
  const [ruleKindFilter, setRuleKindFilter] = useState<RuleKindFilter>("all");
  const [ruleServerFilter, setRuleServerFilter] = useState("all");
  const [ruleHealthFilter, setRuleHealthFilter] = useState<RuleHealthFilter>("all");

  const onlineServers = useMemo(() => {
    const now = Date.now();
    return servers.filter(server => server.lastHeartbeat && now - server.lastHeartbeat < 90000).length;
  }, [servers]);

  const runningTasks = useMemo(() => {
    return tasks.filter(task => ["generated", "claimed", "running"].includes(task.state)).length;
  }, [tasks]);

  const snellNodes = useMemo(() => {
    return protocolNodes.filter(node => node.engine === "snell").length;
  }, [protocolNodes]);

  const xrayNodes = useMemo(() => {
    return protocolNodes.filter(node => node.engine === "xray").length;
  }, [protocolNodes]);

  const activeForwardRules = useMemo(() => {
    return forwardRules.filter(rule => rule.state === "active").length;
  }, [forwardRules]);

  const failedTasks = useMemo(() => {
    return tasks.filter(task => ["failed", "timeout"].includes(task.state)).length;
  }, [tasks]);

  const totalRemoteTraffic = useMemo(() => {
    return servers.reduce((sum, server) => sum + (server.uploadTraffic || 0) + (server.downloadTraffic || 0), 0);
  }, [servers]);

  const activeAlerts = useMemo(() => {
    return monitorAlerts.filter(alert => alert.acknowledged !== 1).length;
  }, [monitorAlerts]);

  const criticalAlerts = useMemo(() => {
    return monitorAlerts.filter(alert => alert.acknowledged !== 1 && alert.severity === "critical").length;
  }, [monitorAlerts]);

  const recentAlerts = useMemo(() => monitorAlerts.slice(0, 5), [monitorAlerts]);

  const recentAuditLogs = useMemo(() => operationAuditLogs.slice(0, 6), [operationAuditLogs]);

  const agentMaintenanceActions = useMemo(() => mergeProviderActions(runtimeProviders), [runtimeProviders]);

  const serverAgentActions = useMemo(() => {
    return dedupeActionsByKey(agentMaintenanceActions.filter(action => action.primary && action.key !== "status"));
  }, [agentMaintenanceActions]);

  const runtimeProviderTaskCounts = useMemo(() => {
    return tasks.reduce<Record<string, number>>((counts, task) => {
      const key = task.runtimeProvider?.key || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [tasks]);

  const runtimeProviderActiveTasks = useMemo(() => {
    return tasks.reduce<Record<string, number>>((counts, task) => {
      if (!["generated", "claimed", "running"].includes(task.state)) {
        return counts;
      }
      const key = task.runtimeProvider?.key || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [tasks]);

  const runtimeStateItems = useMemo<RuntimeStateOverviewItem[]>(() => {
    return runtimeStateOverview?.items || [];
  }, [runtimeStateOverview]);

  const recentRuntimeStateItems = useMemo(() => {
    return runtimeStateItems.slice(0, 12);
  }, [runtimeStateItems]);

  const outboundTagOptions = useMemo(() => uniqueStrings([
    ...DEFAULT_OUTBOUND_TAGS,
    ...outboundTagHints,
    ...trafficSnapshots
      .filter(snapshot => snapshot.sourceType === "outbound")
      .map(snapshot => snapshot.tag || ""),
    ...collectOutboundTags(xraySettingText)
  ]), [outboundTagHints, trafficSnapshots, xraySettingText]);

  const selectedProtocolServer = useMemo(() => {
    return servers.find(server => server.id === protocolNodeForm.serverId);
  }, [protocolNodeForm.serverId, servers]);

  const protocolNodeChecks = useMemo<FormCheck[]>(() => {
    const checks: FormCheck[] = [];
    const add = (state: FormCheckState, label: string, detail: string) => checks.push({ state, label, detail });
    const portInUse = protocolNodes.find(node =>
      node.serverId === protocolNodeForm.serverId &&
      node.port === protocolNodeForm.port &&
      node.id !== protocolNodeForm.id
    );

    if (!protocolNodeForm.serverId) {
      add("missing", t("目标服务器"), t("请选择一台被控服务器。"));
    } else if (!selectedProtocolServer) {
      add("warning", t("目标服务器"), t("服务器列表还未同步，保存前请刷新确认。"));
    } else if (selectedProtocolServer.role === "master") {
      add("warning", t("目标服务器"), t("目标是主控服务器，保存前请确认不会影响控制面。"));
    } else {
      add("ok", t("目标服务器"), t("已选择 {name}", { name: selectedProtocolServer.name }));
    }

    if (selectedProtocolServer && isNanoCriticalServer(selectedProtocolServer) && protocolNodeForm.protocol !== "snell") {
      add("missing", t("Nano 被控"), t("低于 200MB 的 Nano 被控不支持创建 Xray 入站节点，请改用 Snell 或远端端口转发。"));
    }

    if (!protocolNodeForm.port || protocolNodeForm.port < 1 || protocolNodeForm.port > 65535) {
      add("missing", t("端口"), t("端口必须在 1-65535 之间。"));
    } else if (portInUse) {
      add("warning", t("端口"), t("同一服务器已有节点使用该端口：{name}", { name: portInUse.name }));
    } else {
      add("ok", t("端口"), t("端口可用于生成节点任务。"));
    }

    if (protocolNodeForm.protocol === "snell") {
      add(
        isPlaceholderValue(protocolNodeForm.snellPsk) ? "warning" : "ok",
        "Snell PSK",
        isPlaceholderValue(protocolNodeForm.snellPsk)
          ? t("留空会由任务生成，正式环境建议先生成并确认保存。")
          : t("PSK 已填写。")
      );
      add(
        protocolNodeForm.snellVersion.trim() ? "ok" : "missing",
        t("Snell 版本"),
        protocolNodeForm.snellVersion.trim() ? t("已锁定 Snell 版本。") : t("请填写 Snell 版本。")
      );
      return checks;
    }

    if (protocolNodeForm.protocol === "vless" || protocolNodeForm.protocol === "vmess") {
      add(
        isPlaceholderValue(protocolNodeForm.clientId) ? "missing" : "ok",
        t("客户端 UUID"),
        isPlaceholderValue(protocolNodeForm.clientId) ? t("请生成或填写真实 UUID。") : t("UUID 已就绪。")
      );
    }

    if (protocolNodeForm.protocol === "trojan" || protocolNodeForm.protocol === "shadowsocks") {
      add(
        isPlaceholderValue(protocolNodeForm.clientPassword) ? "missing" : "ok",
        t("客户端密码 / PSK"),
        isPlaceholderValue(protocolNodeForm.clientPassword) ? t("请生成或填写真实密码。") : t("凭据已就绪。")
      );
    }

    if (protocolNodeForm.protocol === "vless" && protocolNodeForm.security === "reality") {
      add(
        protocolNodeForm.sni.trim() ? "ok" : "missing",
        "Reality SNI",
        protocolNodeForm.sni.trim() ? t("SNI 已填写。") : t("请填写 Reality SNI。")
      );
      add(
        protocolNodeForm.realityDest.trim()
          ? (protocolNodeForm.realityDest.includes(":") ? "ok" : "warning")
          : "missing",
        "Reality Dest",
        protocolNodeForm.realityDest.trim()
          ? (protocolNodeForm.realityDest.includes(":") ? t("目标地址包含端口。") : t("建议使用 host:port，例如 www.cloudflare.com:443。"))
          : t("请填写 Reality 目标地址。")
      );
      add(
        isPlaceholderValue(protocolNodeForm.realityPrivateKey) ? "missing" : "ok",
        "Reality Private Key",
        isPlaceholderValue(protocolNodeForm.realityPrivateKey) ? t("请生成 Reality 私钥。") : t("Reality 私钥已就绪。")
      );
      add(
        protocolNodeForm.realityShortId.trim() ? "ok" : "warning",
        "Reality Short ID",
        protocolNodeForm.realityShortId.trim() ? t("Short ID 已填写。") : t("可以留空，但生产环境建议生成。")
      );
    } else if (protocolNodeForm.security === "tls") {
      add(
        protocolNodeForm.sni.trim() ? "ok" : "warning",
        "TLS SNI",
        protocolNodeForm.sni.trim() ? t("SNI 已填写。") : t("TLS 节点建议填写域名。")
      );
    }

    if (protocolNodeForm.protocol === "vmess") {
      add(
        protocolNodeForm.wsPath.trim()
          ? (protocolNodeForm.wsPath.trim().startsWith("/") ? "ok" : "warning")
          : "missing",
        "WebSocket Path",
        protocolNodeForm.wsPath.trim()
          ? (protocolNodeForm.wsPath.trim().startsWith("/") ? t("路径格式正确。") : t("路径建议以 / 开头。"))
          : t("请填写 WebSocket 路径。")
      );
    }

    const outboundTag = protocolNodeForm.outboundTag.trim();
    add(
      !outboundTag || outboundTagOptions.includes(outboundTag) ? "ok" : "warning",
      "Outbound Tag",
      !outboundTag
        ? t("留空时使用默认路由。")
        : outboundTagOptions.includes(outboundTag)
          ? t("已匹配已知出站 tag。")
          : t("未在已知出站 tag 中，保存前请确认远端配置存在。")
    );

    return checks;
  }, [outboundTagOptions, protocolNodeForm, protocolNodes, selectedProtocolServer, t]);

  const protocolNodeCheckSummary = useMemo(() => {
    const missing = protocolNodeChecks.filter(check => check.state === "missing").length;
    const warnings = protocolNodeChecks.filter(check => check.state === "warning").length;
    return {
      ok: protocolNodeChecks.length - missing - warnings,
      missing,
      warnings,
      total: protocolNodeChecks.length,
      color: missing > 0 ? "danger" : warnings > 0 ? "warning" : "success"
    };
  }, [protocolNodeChecks]);

  const selectedOrchestrationServers = useMemo(() => {
    return servers.filter(server => orchestrationForm.serverIds.includes(server.id));
  }, [orchestrationForm.serverIds, servers]);

  const selectedOrchestrationHasMaster = selectedOrchestrationServers.some(server => server.role === "master");
  const selectedOrchestrationLowMemoryServers = selectedOrchestrationServers.filter(isLowMemoryServer);
  const selectedOrchestrationCriticalNanoServers = selectedOrchestrationServers.filter(isNanoCriticalServer);
  const selectedOrchestrationUsesFullXuiStack = orchestrationUsesFullXuiStack(orchestrationForm);

  const selectedInboundServer = useMemo(() => {
    return servers.find(server => server.id === threeXuiInboundForm.serverId);
  }, [servers, threeXuiInboundForm.serverId]);

  const rememberOutboundTags = (source: any) => {
    const tags = collectOutboundTags(source);
    if (tags.length > 0) {
      setOutboundTagHints(prev => uniqueStrings([...prev, ...tags]));
    }
  };

  const renderServerOptions = () => servers.map(server => (
    <SelectItem key={server.id.toString()} textValue={server.name}>
      {[
        server.name,
        server.role === "master" ? t("主控高风险") : null,
        isLowMemoryServer(server) ? t("Nano 被控") : null
      ].filter(Boolean).join(" · ")}
    </SelectItem>
  ));

  const renderOutboundTagButtons = (onSelect: (tag: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {outboundTagOptions.map(tag => (
        <Button key={tag} size="sm" variant="flat" onPress={() => onSelect(tag)}>
          {tag}
        </Button>
      ))}
      <Button size="sm" variant="light" onPress={() => onSelect("")}>{t("清空")}</Button>
    </div>
  );

  const unifiedRuleRows = useMemo<UnifiedRuleRow[]>(() => {
    const serverName = (serverId?: number, fallback?: string) => fallback || servers.find(server => server.id === serverId)?.name || (serverId ? `#${serverId}` : "-");
    const healthOf = (status?: string, error?: string): RuleHealth => {
      const normalized = (status || "").toLowerCase();
      if (error || ["failed", "error", "inactive", "disabled"].includes(normalized)) return "error";
      if (!normalized || ["unknown", "not-installed", "pending", "generated", "claimed"].includes(normalized)) return "warning";
      return "healthy";
    };

    const nodeRows = protocolNodes.map(node => ({
      id: `protocol-${node.id}`,
      kind: "protocol" as const,
      title: node.name,
      serverId: node.serverId,
      serverName: serverName(node.serverId, node.serverName),
      protocol: [node.engine, node.protocol, node.transport, node.security].filter(Boolean).join(" / "),
      endpoint: `${node.listen || "*"}:${node.port || "-"}`,
      target: node.remoteId || node.serviceName || "-",
      status: node.state || "-",
      health: healthOf(node.state, node.lastError),
      port: node.port,
      traffic: node.total || ((node.up || 0) + (node.down || 0)),
      syncedAt: node.lastSync,
      detail: `${node.direction || "inbound"} / ${node.serviceName || node.remoteId || "local"}`,
      error: node.lastError,
      node
    }));

    const forwardRows = forwardRules.map(rule => ({
      id: `forward-${rule.id}`,
      kind: "forward" as const,
      title: rule.name,
      serverId: rule.serverId,
      serverName: serverName(rule.serverId, rule.serverName),
      protocol: `${rule.engine || "socat"} / ${rule.protocol || "tcp"}`,
      endpoint: `${rule.listenHost || "0.0.0.0"}:${rule.listenPort}`,
      target: `${rule.targetHost}:${rule.targetPort}`,
      status: rule.state || "-",
      health: healthOf(rule.state, rule.lastError),
      port: rule.listenPort,
      traffic: (rule.up || 0) + (rule.down || 0),
      syncedAt: rule.lastSync,
      detail: rule.serviceName || t("远端转发"),
      error: rule.lastError,
      rule
    }));

    const xuiRows = trafficSnapshots.map(snapshot => ({
      id: `xui-${snapshot.id}`,
      kind: "xui" as const,
      title: snapshot.inboundRemark || snapshot.email || snapshot.tag || `${snapshot.sourceType} #${snapshot.inboundId || snapshot.id}`,
      serverId: snapshot.serverId,
      serverName: serverName(snapshot.serverId, snapshot.serverName),
      protocol: [snapshot.sourceType, snapshot.protocol].filter(Boolean).join(" / "),
      endpoint: snapshot.inboundId ? `inbound #${snapshot.inboundId}` : snapshot.tag || "-",
      target: snapshot.email || snapshot.clientId || snapshot.tag || "-",
      status: snapshot.enable === 0 ? "disabled" : "synced",
      health: snapshot.enable === 0 ? "error" as const : "healthy" as const,
      traffic: snapshot.total || ((snapshot.up || 0) + (snapshot.down || 0)),
      syncedAt: snapshot.syncedTime,
      detail: snapshot.expiryTime ? t("到期 {time}", { time: new Date(snapshot.expiryTime).toLocaleString() }) : t("流量快照"),
      snapshot
    }));

    return [...nodeRows, ...forwardRows, ...xuiRows];
  }, [forwardRules, protocolNodes, servers, t, trafficSnapshots]);

  const filteredRuleRows = useMemo(() => {
    const query = ruleSearch.trim().toLowerCase();
    return unifiedRuleRows.filter(row => {
      if (ruleKindFilter !== "all" && row.kind !== ruleKindFilter) return false;
      if (ruleHealthFilter !== "all" && row.health !== ruleHealthFilter) return false;
      if (ruleServerFilter !== "all" && row.serverId?.toString() !== ruleServerFilter) return false;
      if (!query) return true;
      return [row.title, row.serverName, row.protocol, row.endpoint, row.target, row.status, row.detail]
        .some(value => value.toLowerCase().includes(query));
    });
  }, [ruleHealthFilter, ruleKindFilter, ruleSearch, ruleServerFilter, unifiedRuleRows]);

  const ruleHealthCounts = useMemo(() => {
    return unifiedRuleRows.reduce((counts, row) => {
      counts[row.health] += 1;
      return counts;
    }, { healthy: 0, warning: 0, error: 0 });
  }, [unifiedRuleRows]);

  const ruleServerOptions = useMemo(() => {
    return [{ id: "all", name: t("全部服务器") }, ...servers.map(server => ({ id: server.id.toString(), name: server.name }))];
  }, [servers, t]);


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await ensureDefaultProtocolProfiles();
      const [serverRes, profileRes, taskRes, nodeRes, forwardRes, alertRes, auditRes, providerRes, runtimeStateRes] = await Promise.all([
        getControlServerList(),
        getProtocolProfileList(),
        getDeployTaskList(),
        getProtocolNodeList({ limit: 300 }),
        getServerForwardRuleList({ limit: 300 }),
        listMonitorAlerts({ acknowledged: 0, limit: 100 }),
        listOperationAuditLogs({ limit: 100 }),
        getRuntimeProviderList(),
        getRuntimeStateOverview()
      ]);

      if (serverRes.code === 0) setServers(serverRes.data || []);
      if (profileRes.code === 0) setProfiles(profileRes.data || []);
      if (taskRes.code === 0) setTasks(taskRes.data || []);
      if (nodeRes.code === 0) setProtocolNodes(nodeRes.data || []);
      if (forwardRes.code === 0) setForwardRules(forwardRes.data || []);
      if (alertRes.code === 0) setMonitorAlerts(alertRes.data || []);
      if (auditRes.code === 0) setOperationAuditLogs(auditRes.data || []);
      if (providerRes.code === 0) setRuntimeProviders(providerRes.data || []);
      if (runtimeStateRes.code === 0) setRuntimeStateOverview(runtimeStateRes.data || null);
      if (serverRes.code !== 0 || profileRes.code !== 0 || taskRes.code !== 0 || nodeRes.code !== 0 || forwardRes.code !== 0 || alertRes.code !== 0 || auditRes.code !== 0 || providerRes.code !== 0 || runtimeStateRes.code !== 0) {
        toast.error(t("主控数据加载不完整"));
      }
    } catch (error) {
      toast.error(t("主控中心加载失败"));
    } finally {
      setLoading(false);
    }
  };

  const openServerModal = (server?: ControlServer) => {
    setServerForm(server ? {
      id: server.id,
      name: server.name,
      role: server.role || "agent",
      endpoint: server.endpoint || "",
      xuiEndpoint: server.xuiEndpoint || "",
      xuiBasePath: server.xuiBasePath || "",
      xuiApiToken: server.xuiApiToken || "",
      xuiUsername: server.xuiUsername || "",
      xuiPassword: server.xuiPassword || "",
      xuiTwoFactorCode: server.xuiTwoFactorCode || "",
      xuiAllowInsecure: server.xuiAllowInsecure || 0,
      host: server.host || "",
      sshPort: server.sshPort || 22,
      sshUser: server.sshUser || "root",
      allowInsecure: server.allowInsecure || 0
    } : blankServerForm);
    setServerModalOpen(true);
  };

  const openProfileModal = (profile?: ProtocolProfile) => {
    setProfileForm(profile ? {
      id: profile.id,
      name: profile.name,
      protocol: profile.protocol,
      versionFamily: profile.versionFamily || "xray",
      listenPort: profile.listenPort || 443,
      transport: profile.transport || "tcp",
      remark: profile.remark || "",
      configJson: profile.configJson || "{}"
    } : blankProfileForm);
    setProfileModalOpen(true);
  };

  const openProtocolNodeModal = (server?: ControlServer, node?: ProtocolNode) => {
    const protocol = (node?.protocol || "vless") as ProtocolNodeForm["protocol"];
    const engine = (node?.engine || (protocol === "snell" ? "snell" : "xray")) as ProtocolNodeForm["engine"];
    const savedConfig = safeJsonParse(node?.configJson);
    setProtocolNodeForm({
      ...blankProtocolNodeForm,
      id: node?.id,
      serverId: node?.serverId || server?.id || servers[0]?.id || null,
      name: node?.name || (protocol === "snell" ? "ob-snell" : `ob-${protocol}`),
      protocol,
      engine,
      listen: node?.listen || (protocol === "snell" ? "::0" : ""),
      port: node?.port || (protocol === "snell" ? 8390 : protocol === "vmess" ? 2086 : protocol === "shadowsocks" ? 8388 : 443),
      transport: node?.transport === "ws" ? "ws" : "tcp",
      security: (node?.security as ProtocolNodeForm["security"]) || (protocol === "snell" ? "psk" : protocol === "vless" ? "reality" : protocol === "trojan" ? "tls" : "none"),
      outboundTag: typeof savedConfig?.outboundTag === "string" ? savedConfig.outboundTag : ""
    });
    setProtocolNodePreviewOpen(false);
    setProtocolNodeModalOpen(true);
  };

  const patchProtocolNodeForm = (patch: Partial<ProtocolNodeForm>) => {
    setProtocolNodeForm(prev => ({ ...prev, ...patch }));
  };

  const updateProtocolNodeProtocol = (protocol: ProtocolNodeForm["protocol"]) => {
    const defaults: Record<ProtocolNodeForm["protocol"], Partial<ProtocolNodeForm>> = {
      vless: { protocol, engine: "xray", name: "ob-vless", port: 443, transport: "tcp", security: "reality", flow: "xtls-rprx-vision" },
      vmess: { protocol, engine: "xray", name: "ob-vmess", port: 2086, transport: "ws", security: "none", flow: "" },
      trojan: { protocol, engine: "xray", name: "ob-trojan", port: 8443, transport: "tcp", security: "tls", flow: "" },
      shadowsocks: { protocol, engine: "xray", name: "ob-shadowsocks", port: 8388, transport: "tcp", security: "none", flow: "" },
      snell: { protocol, engine: "snell", name: "ob-snell", listen: "::0", port: 8390, transport: "tcp", security: "psk", flow: "" }
    };
    patchProtocolNodeForm(defaults[protocol]);
  };

  const openServerForwardModal = (server?: ControlServer, rule?: ServerForwardRule) => {
    setServerForwardRuleForm(rule ? {
      id: rule.id,
      serverId: rule.serverId,
      name: rule.name,
      protocol: rule.protocol === "udp" ? "udp" : "tcp",
      listenHost: rule.listenHost || "0.0.0.0",
      listenPort: rule.listenPort,
      targetHost: rule.targetHost,
      targetPort: rule.targetPort
    } : {
      ...blankServerForwardRuleForm,
      serverId: server?.id || servers[0]?.id || null,
      name: server?.name ? `${server.name}-forward` : "remote-forward"
    });
    setServerForwardModalOpen(true);
  };

  const patchServerForwardRuleForm = (patch: Partial<ServerForwardRuleForm>) => {
    setServerForwardRuleForm(prev => ({ ...prev, ...patch }));
  };

  const selectProfileForDeploy = (profileId: number) => {
    const profile = profiles.find(item => item.id === profileId);
    setDeployForm(prev => ({
      ...prev,
      profileId,
      protocol: profile?.protocol || prev.protocol,
      versionFamily: profile?.versionFamily || prev.versionFamily,
      listenPort: profile?.listenPort || prev.listenPort
    }));
  };

  const openDeployModal = (server?: ControlServer) => {
    setDeployForm({
      ...blankDeployForm,
      serverId: server?.id || null
    });
    setDeployModalOpen(true);
  };

  const openOrchestrationModal = (server?: ControlServer) => {
    const firstServer = server || servers[0];
    const host = firstServer?.host || "";
    setOrchestrationForm({
      ...blankOrchestrationForm,
      serverId: firstServer?.id || null,
      serverIds: firstServer?.id ? [firstServer.id] : [],
      publicHost: host,
      certificateDomain: host.includes(".") ? host : "",
      webBasePath: firstServer?.id ? `ob-${firstServer.id}` : "ob-control"
    });
    setOrchestrationModalOpen(true);
  };

  const patchOrchestrationForm = (patch: Partial<OrchestrationForm>) => {
    setOrchestrationForm(prev => ({ ...prev, ...patch }));
  };

  const saveServer = async () => {
    if (!serverForm.name.trim() || !serverForm.host.trim()) {
      toast.error(t("请填写服务器名称和主机地址"));
      return;
    }

    setSubmitting(true);
    const payload = {
      ...serverForm,
      endpoint: serverForm.endpoint || null
    };
    const res = serverForm.id ? await updateControlServer(payload) : await createControlServer(payload);
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(serverForm.id ? t("服务器已更新") : t("服务器已添加"));
      setServerModalOpen(false);
      loadData();
    } else {
      toast.error(res.msg || t("保存服务器失败"));
    }
  };

  const saveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.protocol.trim()) {
      toast.error(t("请填写协议模板名称和协议"));
      return;
    }

    setSubmitting(true);
    const res = profileForm.id ? await updateProtocolProfile(profileForm) : await createProtocolProfile(profileForm);
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(profileForm.id ? t("协议模板已更新") : t("协议模板已添加"));
      setProfileModalOpen(false);
      loadData();
    } else {
      toast.error(res.msg || t("保存协议模板失败"));
    }
  };

  const saveProtocolNode = async () => {
    if (!protocolNodeForm.serverId) {
      toast.error(t("请选择目标服务器"));
      return;
    }
    if (!protocolNodeForm.name.trim()) {
      toast.error(t("请填写节点名称"));
      return;
    }
    if (!protocolNodeForm.port || protocolNodeForm.port < 1 || protocolNodeForm.port > 65535) {
      toast.error(t("节点端口不合法"));
      return;
    }
    if (protocolNodeForm.protocol !== "snell" && isNanoCriticalServer(selectedProtocolServer)) {
      toast.error(t("Nano 被控低于 200MB，不支持创建 Xray 入站节点；请改用 Snell 或远端端口转发。"));
      return;
    }

    const isSnell = protocolNodeForm.protocol === "snell";
    const payload = isSnell ? undefined : withOutboundTag(
      buildInboundPayloadFromForm(inboundFormFromNodeForm(protocolNodeForm)),
      protocolNodeForm.outboundTag
    );
    const requestPayload = isSnell ? {
      id: protocolNodeForm.id,
      serverId: protocolNodeForm.serverId,
      name: protocolNodeForm.name,
      protocol: "snell",
      engine: "snell",
      direction: "inbound",
      listen: protocolNodeForm.listen || "::0",
      port: protocolNodeForm.port,
      transport: "tcp",
      security: "psk",
      credentialJson: JSON.stringify({ psk: protocolNodeForm.snellPsk }),
      configJson: JSON.stringify({ version: protocolNodeForm.snellVersion || "v4.1.1" })
    } : {
      id: protocolNodeForm.id,
      serverId: protocolNodeForm.serverId,
      name: protocolNodeForm.name,
      protocol: protocolNodeForm.protocol,
      engine: "xray",
      direction: "inbound",
      listen: protocolNodeForm.listen,
      port: protocolNodeForm.port,
      transport: protocolNodeForm.transport,
      security: protocolNodeForm.security,
      configJson: JSON.stringify(payload),
      payload
    };

    setSubmitting(true);
    const res = protocolNodeForm.id ? await updateProtocolNode(requestPayload) : await createProtocolNode(requestPayload);
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(isSnell ? t("Snell 节点任务已生成") : t("Xray 入站节点已创建"));
      setProtocolNodeModalOpen(false);
      loadData();
    } else {
      toast.error(res.msg || t("保存协议节点失败"));
    }
  };

  const syncServerProtocolNodes = async (server: ControlServer) => {
    const res = await syncProtocolNodes(server.id);
    if (res.code === 0) {
      toast.success(t("协议节点已同步"));
      loadData();
    } else {
      toast.error(res.msg || t("同步协议节点失败"));
    }
  };

  const requestUiConfirmation = (confirmation: PendingUiConfirmation) => {
    setPendingUiConfirmation(confirmation);
  };

  const confirmPendingUiAction = async () => {
    if (!pendingUiConfirmation) {
      return;
    }
    const pending = pendingUiConfirmation;
    setPendingUiConfirmation(null);
    await pending.onConfirm();
  };

  const removeProtocolNode = async (node: ProtocolNode, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认删除"),
        message: t("确定删除协议节点 {name}?", { name: node.name || node.id }),
        detail: t("如该节点由被控 Agent 托管, 主控会生成远端清理任务。"),
        confirmText: t("确认删除"),
        color: "danger",
        testId: "confirm-delete-protocol-node",
        onConfirm: () => removeProtocolNode(node, true)
      });
      return;
    }
    const res = await deleteProtocolNode(node.id);
    if (res.code === 0) {
      toast.success(node.engine === "snell" ? t("Snell 删除任务已生成") : t("协议节点已删除"));
      loadData();
    } else {
      toast.error(res.msg || t("删除协议节点失败"));
    }
  };

  const restartNode = async (node: ProtocolNode, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认重启"),
        message: t("确定重启协议节点 {name}?", { name: node.name || node.id }),
        detail: t("节点可能会短暂中断。"),
        confirmText: t("确认重启"),
        color: "warning",
        testId: "confirm-restart-protocol-node",
        onConfirm: () => restartNode(node, true)
      });
      return;
    }
    const res = await restartProtocolNode(node.id);
    if (res.code === 0) {
      toast.success(node.engine === "snell" ? t("Snell 重启任务已生成") : t("已请求重启 Xray"));
      loadData();
    } else {
      toast.error(res.msg || t("重启协议节点失败"));
    }
  };

  const saveServerForwardRule = async () => {
    if (!serverForwardRuleForm.serverId) {
      toast.error(t("请选择目标服务器"));
      return;
    }
    if (!serverForwardRuleForm.name.trim() || !serverForwardRuleForm.targetHost.trim()) {
      toast.error(t("请填写规则名称和目标地址"));
      return;
    }
    if (!serverForwardRuleForm.listenPort || serverForwardRuleForm.listenPort < 1 || serverForwardRuleForm.listenPort > 65535) {
      toast.error(t("监听端口不合法"));
      return;
    }
    if (!serverForwardRuleForm.targetPort || serverForwardRuleForm.targetPort < 1 || serverForwardRuleForm.targetPort > 65535) {
      toast.error(t("目标端口不合法"));
      return;
    }

    setSubmitting(true);
    const payload = {
      ...serverForwardRuleForm,
      listenHost: serverForwardRuleForm.listenHost || "0.0.0.0"
    };
    const res = serverForwardRuleForm.id ? await updateServerForwardRule(payload) : await createServerForwardRule(payload);
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(t("远端端口转发任务已生成"));
      setServerForwardModalOpen(false);
      loadData();
    } else {
      toast.error(res.msg || t("保存远端端口转发失败"));
    }
  };

  const removeServerForwardRule = async (rule: ServerForwardRule, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认删除"),
        message: t("确定删除远端转发 {name}?", { name: rule.name || rule.id }),
        detail: t("主控会生成被控端清理任务。"),
        confirmText: t("确认删除"),
        color: "danger",
        testId: "confirm-delete-forward-rule",
        onConfirm: () => removeServerForwardRule(rule, true)
      });
      return;
    }
    const res = await deleteServerForwardRule(rule.id);
    if (res.code === 0) {
      toast.success(t("远端转发删除任务已生成"));
      loadData();
    } else {
      toast.error(res.msg || t("删除远端转发失败"));
    }
  };

  const restartForwardRule = async (rule: ServerForwardRule, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认重启"),
        message: t("确定重启远端转发 {name}?", { name: rule.name || rule.id }),
        detail: t("转发连接可能会短暂中断。"),
        confirmText: t("确认重启"),
        color: "warning",
        testId: "confirm-restart-forward-rule",
        onConfirm: () => restartForwardRule(rule, true)
      });
      return;
    }
    const res = await restartServerForwardRule(rule.id);
    if (res.code === 0) {
      toast.success(t("远端转发重启任务已生成"));
      loadData();
    } else {
      toast.error(res.msg || t("重启远端转发失败"));
    }
  };

  const showServerRuleOverview = async (server: ControlServer) => {
    const res = await getServerRuleOverview(server.id);
    if (res.code === 0) {
      showThreeXuiResult(t("{name} 出入站与转发规则", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || t("读取服务器规则失败"));
    }
  };

  const saveDeployTask = async () => {
    if (!deployForm.serverId) {
      toast.error(t("请选择目标服务器"));
      return;
    }
    if (!deployForm.protocol.trim()) {
      toast.error(t("请选择协议"));
      return;
    }

    setSubmitting(true);
    const res = await createDeployTask(deployForm);
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(t("部署任务已生成"));
      setDeployModalOpen(false);
      setScriptTitle(t("任务 #{id} 脚本", { id: res.data.id }));
      setScriptText(res.data.script || "");
      setScriptModalOpen(true);
      loadData();
    } else {
      toast.error(res.msg || t("生成部署任务失败"));
    }
  };

  const createAgentMaintenance = async (server: ControlServer, action: AgentMaintenanceAction, meta: Record<string, unknown> = {}) => {
    const actionKey = typeof action === "string" ? action : action.key;
    const actionMeta = typeof action === "string"
      ? agentMaintenanceActions.find(item => item.key === actionKey)
      : action;
    const actionText = actionLabel(actionMeta || action, agentMaintenanceActions);

    if (actionMeta?.danger) {
      setPendingAgentMaintenance({ server, actionKey, actionText, actionMeta, meta });
      return;
    }

    await executeAgentMaintenance({ server, actionKey, actionText, actionMeta, meta });
  };

  const executeAgentMaintenance = async ({ server, actionKey, actionText, actionMeta, meta }: PendingAgentMaintenance) => {
    setSubmitting(true);
    const res = await createDeployTask({
      serverId: server.id,
      protocol: "agent-maintenance",
      action: actionKey,
      requestJson: JSON.stringify({
        source: "orchestrator-ui",
        ...meta,
        serverId: server.id,
        serverName: server.name,
        action: actionKey,
        actionLabel: actionText,
        actionProvider: actionMeta?.providerKey,
        actionCategory: actionMeta?.category,
        dangerConfirmed: Boolean(actionMeta?.danger),
        confirmAction: actionMeta?.danger ? actionKey : undefined
      })
    });
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(t("{name} {action}任务已生成", { name: server.name, action: t(actionText) }));
      setScriptTitle(t("任务 #{id} / {name} / {action}", { id: res.data.id, name: server.name, action: t(actionText) }));
      setScriptText(res.data.script || "");
      setScriptModalOpen(true);
      loadData();
    } else {
      toast.error(res.msg || t("{action}任务生成失败", { action: t(actionText) }));
    }
  };

  const confirmPendingAgentMaintenance = async () => {
    if (!pendingAgentMaintenance) {
      return;
    }
    const pending = pendingAgentMaintenance;
    setPendingAgentMaintenance(null);
    await executeAgentMaintenance(pending);
  };

  const saveOrchestrationTask = async () => {
    const targetServerIds = orchestrationForm.serverIds.length > 0
      ? orchestrationForm.serverIds
      : orchestrationForm.serverId ? [orchestrationForm.serverId] : [];
    if (targetServerIds.length === 0) {
      toast.error(t("请选择目标服务器"));
      return;
    }
    if (orchestrationForm.certificateMode === "acme-http" && !orchestrationForm.certificateDomain.trim()) {
      toast.error(t("ACME 证书模式需要填写域名"));
      return;
    }
    if (selectedOrchestrationCriticalNanoServers.length > 0 && selectedOrchestrationUsesFullXuiStack) {
      toast.error(t("Nano 被控内存低于 200MB，不支持完整 Xray 编排；请关闭 Xray 相关选项，仅保留 Snell 或端口转发。"));
      return;
    }
    const ports = [
      ["面板", orchestrationForm.panelPort, true],
      ["VLESS Reality", orchestrationForm.vlessPort, orchestrationForm.createVlessReality],
      ["VMess WS", orchestrationForm.vmessPort, orchestrationForm.createVmessWs],
      ["Trojan TLS", orchestrationForm.trojanPort, orchestrationForm.createTrojanTls],
      ["Shadowsocks", orchestrationForm.shadowsocksPort, orchestrationForm.createShadowsocks],
      ["Snell", orchestrationForm.snellPort, orchestrationForm.installSnell]
    ] as const;
    const usedPorts = new Map<number, string>();
    for (const [name, port, enabled] of ports) {
      if (!enabled) continue;
      if (!port || port < 1 || port > 65535) {
        toast.error(t("{name} 端口不合法", { name: t(name) }));
        return;
      }
      if (usedPorts.has(port)) {
        toast.error(t("{name} 端口与 {used} 重复", { name: t(name), used: t(usedPorts.get(port) || "") }));
        return;
      }
      usedPorts.set(port, name);
    }

    setSubmitting(true);
    const results = [];
    for (const serverId of targetServerIds) {
      const payload = { ...orchestrationForm } as any;
      delete payload.serverIds;
      const targetServer = servers.find(server => server.id === serverId);
      results.push(await createOrchestrationTask({
        ...payload,
        serverId,
        publicHost: targetServer?.host || orchestrationForm.publicHost,
        certificateDomain: orchestrationForm.certificateDomain || (targetServer?.host?.includes(".") ? targetServer.host : "")
      }));
    }
    setSubmitting(false);

    const failed = results.find(res => res.code !== 0);
    if (!failed) {
      toast.success(t("已生成 {count} 个一键编排任务，等待副控 agent 自动领取", { count: results.length }));
      setOrchestrationModalOpen(false);
      setScriptTitle(t("一键编排任务"));
      setScriptText(results.map(res => `# Task ${res.data.id} / ${res.data.serverName || res.data.serverId}\n${res.data.script || ""}`).join("\n\n"));
      setScriptModalOpen(true);
      loadData();
    } else {
      toast.error(failed.msg || t("生成一键编排任务失败"));
    }
  };

  const showServerToken = async (server: ControlServer, rotate = false) => {
    const res = rotate ? await rotateControlServerToken(server.id) : await getControlServerToken(server.id);
    if (res.code === 0) {
      setScriptTitle(`${server.name} Agent Token`);
      setScriptText(res.data || "");
      setScriptModalOpen(true);
      if (rotate) loadData();
    } else {
      toast.error(res.msg || t("读取 token 失败"));
    }
  };

  const showTaskScript = async (task: DeployTask) => {
    const res = await getDeployTaskScript(task.id);
    if (res.code === 0) {
      setScriptTitle(t("任务 #{id} {protocol}", { id: task.id, protocol: task.protocol }));
      setScriptText(res.data || "");
      setScriptModalOpen(true);
    } else {
      toast.error(res.msg || t("读取脚本失败"));
    }
  };

  const showTaskResult = (task: DeployTask) => {
    const parsed = safeJsonParse(task.resultJson);
    setScriptTitle(t("任务 #{id} 原始结果", { id: task.id }));
    setScriptText(parsed ? JSON.stringify(parsed, null, 2) : task.resultJson || t("暂无原始结果"));
    setScriptModalOpen(true);
  };

  const isThreeXuiSuccess = (res: any) => res.code === 0 && (!res.data || res.data.success !== false);

  const showThreeXuiResult = (title: string, data: any) => {
    setScriptTitle(title);
    setScriptText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    setScriptModalOpen(true);
  };

  const testXui = async (server: ControlServer) => {
    const res = await testThreeXuiConnection(server.id);
    if (isThreeXuiSuccess(res)) {
      toast.success(t("兼容 API 连接正常"));
      showThreeXuiResult(t("{name} 运行时状态", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("兼容 API 连接失败"));
    }
  };

  const showThreeXuiInbounds = async (server: ControlServer) => {
    const res = await listThreeXuiInbounds(server.id);
    if (isThreeXuiSuccess(res)) {
      showThreeXuiResult(t("{name} 入站列表", { name: server.name }), res.data);
      loadData();
    } else {
      toast.error(res.msg || res.data?.msg || t("读取入站失败"));
    }
  };

  const showThreeXuiConfig = async (server: ControlServer) => {
    const res = await getThreeXuiConfig(server.id);
    if (isThreeXuiSuccess(res)) {
      showThreeXuiResult(t("{name} Xray 配置", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取配置失败"));
    }
  };

  const showThreeXuiOutbounds = async (server: ControlServer) => {
    const res = await getThreeXuiOutbounds(server.id);
    if (isThreeXuiSuccess(res)) {
      rememberOutboundTags(res.data);
      showThreeXuiResult(t("{name} 出站配置", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取出站失败"));
    }
  };

  const showThreeXuiOutboundTraffic = async (server: ControlServer) => {
    const res = await getThreeXuiOutboundTraffic(server.id);
    if (isThreeXuiSuccess(res)) {
      showThreeXuiResult(t("{name} 出站流量", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取出站流量失败"));
    }
  };

  const syncXuiTraffic = async (server: ControlServer) => {
    const res = await syncThreeXuiTraffic(server.id);
    if (isThreeXuiSuccess(res)) {
      toast.success(t("远端流量已同步入库"));
      showThreeXuiResult(t("{name} 流量同步结果", { name: server.name }), res.data);
      loadData();
    } else {
      toast.error(res.msg || res.data?.msg || t("同步流量失败"));
    }
  };

  const showTrafficSnapshots = async (server: ControlServer) => {
    const res = await listThreeXuiTraffic({ serverId: server.id, limit: 120 });
    if (res.code === 0) {
      const snapshots = res.data || [];
      setTrafficSnapshots(snapshots);
      showThreeXuiResult(t("{name} 本地流量快照", { name: server.name }), snapshots);
    } else {
      toast.error(res.msg || t("读取本地流量快照失败"));
    }
  };

  const openThreeXuiInboundModal = (server: ControlServer) => {
    setThreeXuiInboundForm({
      ...blankThreeXuiInboundForm,
      serverId: server.id,
      payloadJson: inboundPayloadPreview({ ...blankThreeXuiInboundForm, serverId: server.id })
    });
    setThreeXuiInboundModalOpen(true);
  };

  const patchThreeXuiInboundForm = (patch: Partial<ThreeXuiInboundForm>) => {
    setThreeXuiInboundForm(prev => {
      const next = { ...prev, ...patch };
      return {
        ...next,
        payloadJson: next.editMode === "form" ? inboundPayloadPreview(next) : next.payloadJson
      };
    });
  };

  const updateInboundProtocol = (protocol: ThreeXuiInboundForm["protocol"]) => {
    const defaults: Record<ThreeXuiInboundForm["protocol"], Partial<ThreeXuiInboundForm>> = {
      vless: { protocol, remark: "ob-vless", port: 443, network: "tcp", security: "reality", flow: "xtls-rprx-vision" },
      vmess: { protocol, remark: "ob-vmess", port: 2086, network: "ws", security: "none", flow: "" },
      trojan: { protocol, remark: "ob-trojan", port: 443, network: "tcp", security: "tls", flow: "" },
      shadowsocks: { protocol, remark: "ob-shadowsocks", port: 8388, network: "tcp", security: "none", flow: "" }
    };
    patchThreeXuiInboundForm(defaults[protocol]);
  };

  const saveThreeXuiInbound = async (confirmed = false) => {
    if (!threeXuiInboundForm.serverId) {
      toast.error(t("请选择服务器"));
      return;
    }
    if (threeXuiInboundForm.mode !== "add" && !threeXuiInboundForm.inboundId.trim()) {
      toast.error(t("更新或删除入站时必须填写 inbound id"));
      return;
    }
    if (threeXuiInboundForm.mode === "delete" && !confirmed) {
      requestUiConfirmation({
        title: t("确认删除入站"),
        message: t("确定删除入站 #{id}?", { id: threeXuiInboundForm.inboundId || "-" }),
        detail: t("该操作会直接修改远端 Xray 入站配置。"),
        confirmText: t("确认删除"),
        color: "danger",
        testId: "confirm-delete-xray-inbound",
        onConfirm: () => saveThreeXuiInbound(true)
      });
      return;
    }

    setSubmitting(true);
    let res: any;
    try {
      const inboundId = threeXuiInboundForm.inboundId ? Number(threeXuiInboundForm.inboundId) : undefined;
      if (threeXuiInboundForm.mode === "delete") {
        res = await deleteThreeXuiInbound({ serverId: threeXuiInboundForm.serverId, inboundId });
      } else {
        const payload = threeXuiInboundForm.editMode === "json"
          ? JSON.parse(threeXuiInboundForm.payloadJson)
          : buildInboundPayloadFromForm(threeXuiInboundForm);
        res = threeXuiInboundForm.mode === "add"
          ? await addThreeXuiInbound({ serverId: threeXuiInboundForm.serverId, payload })
          : await updateThreeXuiInbound({ serverId: threeXuiInboundForm.serverId, inboundId, payload });
      }
    } catch (error) {
      setSubmitting(false);
      toast.error(threeXuiInboundForm.editMode === "json" ? t("入站 JSON 格式不正确") : t("入站表单内容不完整"));
      return;
    }
    setSubmitting(false);

    if (isThreeXuiSuccess(res)) {
      toast.success(t("入站操作已提交"));
      setThreeXuiInboundModalOpen(false);
      showThreeXuiResult(t("入站操作结果"), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("入站操作失败"));
    }
  };

  const openXraySettingModal = async (server: ControlServer) => {
    const res = await getThreeXuiConfig(server.id);
    if (!isThreeXuiSuccess(res)) {
      toast.error(res.msg || res.data?.msg || t("读取 Xray 配置失败"));
      return;
    }

    const config = res.data?.obj || res.data;
    setXraySettingServerId(server.id);
    setXraySettingText(typeof config === "string" ? config : JSON.stringify(config, null, 2));
    rememberOutboundTags(config);
    setOutboundTestUrl("https://www.google.com/generate_204");
    setXraySettingModalOpen(true);
  };

  const saveXraySetting = async (confirmed = false) => {
    if (!xraySettingServerId) {
      toast.error(t("缺少服务器"));
      return;
    }
    try {
      JSON.parse(xraySettingText);
    } catch (error) {
      toast.error(t("Xray 配置 JSON 格式不正确"));
      return;
    }
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认保存出站"),
        message: t("确定保存 Xray / Outbound 出站配置?"),
        detail: t("无效出站 JSON 可能影响远端路由, 请确认内容后继续。"),
        confirmText: t("确认保存"),
        color: "warning",
        testId: "confirm-save-xray-setting",
        onConfirm: () => saveXraySetting(true)
      });
      return;
    }

    setSubmitting(true);
    const res = await saveThreeXuiOutbounds({
      serverId: xraySettingServerId,
      xraySetting: xraySettingText,
      outboundTestUrl
    });
    setSubmitting(false);

    if (isThreeXuiSuccess(res)) {
      toast.success(t("出站配置已保存"));
      setXraySettingModalOpen(false);
      showThreeXuiResult(t("出站保存结果"), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("保存出站配置失败"));
    }
  };

  const restartXray = async (server: ControlServer, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认重启 Xray"),
        message: t("确定重启 {name} 的 Xray?", { name: server.name }),
        detail: t("该服务器上的活动连接可能会重新连接。"),
        confirmText: t("确认重启"),
        color: "warning",
        testId: "confirm-restart-xray",
        onConfirm: () => restartXray(server, true)
      });
      return;
    }
    const res = await restartThreeXuiXray(server.id);
    if (isThreeXuiSuccess(res)) {
      toast.success(t("已请求重启 Xray"));
      showThreeXuiResult(t("{name} Xray 重启结果", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("重启 Xray 失败"));
    }
  };

  const copyScript = async () => {
    await navigator.clipboard.writeText(scriptText);
    toast.success(t("已复制"));
  };

  const copyRuleData = async (row: UnifiedRuleRow) => {
    const payload = [
      `${t("名称")}=${row.title}`,
      `${t("类型")}=${row.kind}`,
      `${t("服务器")}=${row.serverName}`,
      `${t("协议")}=${row.protocol}`,
      `${t("入口")}=${row.endpoint}`,
      `${t("目标")}=${row.target}`,
      `${t("状态")}=${row.status}`
    ].join("\n");
    await navigator.clipboard.writeText(payload);
    toast.success(t("规则信息已复制"));
  };

  const acknowledgeAlert = async (alert: MonitorAlert) => {
    const res = await acknowledgeMonitorAlert(alert.id);
    if (res.code === 0) {
      toast.success(t("告警已确认"));
      loadData();
    } else {
      toast.error(res.msg || t("确认告警失败"));
    }
  };

  const removeServer = async (server: ControlServer, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认删除服务器"),
        message: t("确定删除被控服务器 {name}?", { name: server.name }),
        detail: t("该操作只删除主控记录, 不会自动卸载远端服务。"),
        confirmText: t("确认删除"),
        color: "danger",
        testId: "confirm-delete-server",
        onConfirm: () => removeServer(server, true)
      });
      return;
    }
    const res = await deleteControlServer(server.id);
    if (res.code === 0) {
      toast.success(t("服务器已删除"));
      loadData();
    } else {
      toast.error(res.msg || t("删除失败"));
    }
  };

  const removeProfile = async (profile: ProtocolProfile, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认删除模板"),
        message: t("确定删除协议模板 {name}?", { name: profile.name || profile.id }),
        detail: t("已有节点不会变化, 但该模板无法继续复用。"),
        confirmText: t("确认删除"),
        color: "danger",
        testId: "confirm-delete-profile",
        onConfirm: () => removeProfile(profile, true)
      });
      return;
    }
    const res = await deleteProtocolProfile(profile.id);
    if (res.code === 0) {
      toast.success(t("协议模板已删除"));
      loadData();
    } else {
      toast.error(res.msg || t("删除失败"));
    }
  };

  const removeTask = async (task: DeployTask, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认删除任务"),
        message: t("确定删除部署任务 #{id}?", { id: task.id }),
        detail: t("该任务的脚本和执行结果记录会被移除。"),
        confirmText: t("确认删除"),
        color: "danger",
        testId: "confirm-delete-task",
        onConfirm: () => removeTask(task, true)
      });
      return;
    }
    const res = await deleteDeployTask(task.id);
    if (res.code === 0) {
      toast.success(t("部署任务已删除"));
      loadData();
    } else {
      toast.error(res.msg || t("删除失败"));
    }
  };

  const retryTask = async (task: DeployTask) => {
    const res = await retryDeployTask(task.id);
    if (res.code === 0) {
      toast.success(t("重试任务已生成"));
      setScriptTitle(t("任务 #{id} 脚本", { id: res.data.id }));
      setScriptText(res.data.script || "");
      setScriptModalOpen(true);
      loadData();
    } else {
      toast.error(res.msg || t("重试任务失败"));
    }
  };

  const formatTime = (time?: number) => {
    if (!time) return "-";
    return new Date(time).toLocaleString();
  };

  const formatBytes = (value?: number) => {
    if (!value) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  };

  const heartbeatColor = (server: ControlServer) => {
    if (server.lastError) return "danger";
    if (!server.lastHeartbeat) return "warning";
    return Date.now() - server.lastHeartbeat < 90000 ? "success" : "warning";
  };

  const heartbeatText = (server: ControlServer) => {
    if (server.lastError) return t("异常");
    if (!server.lastHeartbeat) return t("未连接");
    return Date.now() - server.lastHeartbeat < 90000 ? t("在线") : t("离线");
  };

  const serviceColor = (status?: string) => {
    if (!status) return "default";
    const normalized = status.toLowerCase();
    if (["active", "valid", "running", "healthy", "ok", "success", "succeeded", "synced"].includes(normalized)) return "success";
    if (["expiring", "unknown", "not-installed", "pending", "generated", "claimed"].includes(normalized)) return "warning";
    return "danger";
  };

  const formCheckColor = (state: FormCheckState) => {
    if (state === "ok") return "success";
    if (state === "warning") return "warning";
    return "danger";
  };

  const alertSeverityColor = (severity?: string) => {
    if (severity === "critical") return "danger";
    if (severity === "warning") return "warning";
    return "default";
  };

  const auditOutcomeColor = (outcome?: string) => {
    if (!outcome) return "default";
    if (["succeeded", "requested", "claimed"].includes(outcome)) return "success";
    if (["failed", "timeout", "rejected"].includes(outcome)) return "danger";
    if (outcome === "running") return "primary";
    return "default";
  };

  const auditOutcomeLabel = (outcome?: string) => {
    if (outcome === "requested") return t("已请求");
    if (outcome === "claimed") return t("已领取");
    if (outcome === "succeeded") return t("已成功");
    if (outcome === "failed") return t("已失败");
    if (outcome === "timeout") return t("已超时");
    if (outcome === "rejected") return t("已拒绝");
    return outcome || "-";
  };

  const certificateText = (server: ControlServer) => {
    if (!server.certificateStatus) return t("证书 -");
    const domain = server.certificateDomain ? ` ${server.certificateDomain}` : "";
    return `${server.certificateStatus}${domain}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 dark:bg-black" data-testid="control-center">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between" data-testid="control-center-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("主控中心")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("服务器编排、统一协议节点、Snell / Xray 运维")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button color="primary" data-testid="open-orchestration" onPress={() => openOrchestrationModal()}>{t("一键编排")}</Button>
            <Button color="primary" variant="flat" data-testid="open-protocol-node" onPress={() => openProtocolNodeModal()}>{t("新增节点")}</Button>
            <Button color="primary" data-testid="open-deploy-task" onPress={() => openDeployModal()}>{t("新建部署")}</Button>
            <Button variant="flat" data-testid="open-server-modal" onPress={() => openServerModal()}>{t("添加服务器")}</Button>
            <Button variant="flat" data-testid="open-profile-modal" onPress={() => openProfileModal()}>{t("添加模板")}</Button>
          </div>
        </div>

        <section data-testid="controlled-server-status">
          <Card radius="sm" className="border border-default-200 bg-white dark:bg-default-50/5">
            <CardHeader className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("被控端状态")}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {t("主控直接汇总被控心跳、Xray、Snell、证书和任务状态；异常会在这里先露出。")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="flat" color="success">{t("{count} 台在线", { count: onlineServers })}</Chip>
                <Chip size="sm" variant="flat" color={failedTasks > 0 ? "danger" : "default"}>{t("{count} 个失败任务", { count: failedTasks })}</Chip>
                <Chip size="sm" variant="flat" color={criticalAlerts > 0 ? "danger" : "default"}>{t("{count} 条严重告警", { count: criticalAlerts })}</Chip>
                <Button size="sm" variant="light" onPress={loadData}>{t("刷新")}</Button>
              </div>
            </CardHeader>
            <CardBody>
              {servers.length === 0 ? (
                <div className="rounded-small border border-dashed border-default-300 p-5 text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{t("还没有被控端")}</p>
                  <p className="mt-1 text-sm text-gray-500">{t("添加服务器后，心跳、服务状态和规则同步状态会在这里显示。")}</p>
                  <Button size="sm" color="primary" variant="flat" className="mt-4" onPress={() => openServerModal()}>{t("添加服务器")}</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {servers.slice(0, 6).map(server => (
                    <div key={`status-${server.id}`} className="rounded-small border border-default-200 bg-default-50/60 p-3 dark:bg-default-100/5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-white">{server.name}</p>
                          <p className="truncate text-xs text-gray-500">{server.host}:{server.sshPort || 22}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          <Chip size="sm" variant="flat" color={server.role === "master" ? "warning" : "default"}>{server.role === "master" ? t("主控") : t("副控")}</Chip>
                          <Chip size="sm" variant="flat" color={heartbeatColor(server) as any}>{heartbeatText(server)}</Chip>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-small bg-white px-2 py-1.5 dark:bg-default-50/5">
                          <p className="text-gray-500">Xray</p>
                          <p className="truncate font-medium text-gray-900 dark:text-white">{server.xrayServiceStatus || "-"}</p>
                        </div>
                        <div className="rounded-small bg-white px-2 py-1.5 dark:bg-default-50/5">
                          <p className="text-gray-500">Snell</p>
                          <p className="truncate font-medium text-gray-900 dark:text-white">{server.snellServiceStatus || "-"}</p>
                        </div>
                        <div className="rounded-small bg-white px-2 py-1.5 dark:bg-default-50/5">
                          <p className="text-gray-500">{t("兼容 API")}</p>
                          <p className="truncate font-medium text-gray-900 dark:text-white">{server.xuiServiceStatus || (server.xuiEndpoint ? t("已配置") : "-")}</p>
                        </div>
                        <div className="rounded-small bg-white px-2 py-1.5 dark:bg-default-50/5">
                          <p className="text-gray-500">{t("内存")}</p>
                          <p className="truncate font-medium text-gray-900 dark:text-white">{server.memoryTotalMb ? `${server.memoryTotalMb} MB` : "-"}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Chip size="sm" variant="flat">{t("心跳：{time}", { time: formatTime(server.lastHeartbeat) })}</Chip>
                        <Chip size="sm" variant="flat">{t("规则同步：{time}", { time: formatTime(server.xuiLastSync) })}</Chip>
                        {server.lastError && <Chip size="sm" variant="flat" color="danger">{server.lastError}</Chip>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {servers.length > 6 && (
                <p className="mt-3 text-xs text-gray-500">{t("下方服务器列表保留全部 {count} 台被控端。", { count: servers.length })}</p>
              )}
            </CardBody>
          </Card>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card radius="sm">
            <CardBody>
              <p className="text-sm text-gray-500">{t("服务器")}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{servers.length}</p>
              <p className="text-xs text-gray-500 mt-1">{t("{count} 台在线", { count: onlineServers })}</p>
            </CardBody>
          </Card>
          <Card radius="sm">
            <CardBody>
              <p className="text-sm text-gray-500">{t("协议节点")}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{protocolNodes.length}</p>
              <p className="text-xs text-gray-500 mt-1">Xray {xrayNodes} / Snell {snellNodes}</p>
            </CardBody>
          </Card>
          <Card radius="sm">
            <CardBody>
              <p className="text-sm text-gray-500">{t("部署任务")}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{tasks.length}</p>
              <p className="text-xs text-gray-500 mt-1">{t("{running} 个等待/运行，{failed} 个失败", { running: runningTasks, failed: failedTasks })}</p>
            </CardBody>
          </Card>
          <Card radius="sm">
            <CardBody>
              <p className="text-sm text-gray-500">{t("远端转发")}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{forwardRules.length}</p>
              <p className="text-xs text-gray-500 mt-1">{t("{active} 条 active，{snapshots} 条快照，流量 {traffic}", { active: activeForwardRules, snapshots: trafficSnapshots.length, traffic: formatBytes(totalRemoteTraffic) })}</p>
            </CardBody>
          </Card>
        </div>

        <section data-testid="state-sync">
          <Card radius="sm">
            <CardHeader className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("State Sync 状态同步")}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t("按服务器和 Runtime Provider 聚合 agent 心跳、任务结果、服务、节点、证书和诊断状态。")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="flat" color="success">{t("{count} 健康", { count: runtimeStateOverview?.healthy || 0 })}</Chip>
                <Chip size="sm" variant="flat" color="warning">{t("{count} 观察", { count: runtimeStateOverview?.warning || 0 })}</Chip>
                <Chip size="sm" variant="flat" color="danger">{t("{count} 异常", { count: runtimeStateOverview?.failed || 0 })}</Chip>
                <Chip size="sm" variant="flat">{t("{count} 未知", { count: runtimeStateOverview?.unknown || 0 })}</Chip>
                <Button size="sm" variant="light" onPress={loadData}>{t("刷新")}</Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {!runtimeStateOverview || runtimeStateItems.length === 0 ? (
                <div className="rounded-small border border-dashed border-default-300 p-5 text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{t("暂无运行时状态")}</p>
                  <p className="text-sm text-gray-500 mt-1">{t("Agent 回报和服务器心跳会在这里聚合。")}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                      <p className="text-xs text-gray-500">{t("服务器")}</p>
                      <p className="text-xl font-semibold text-gray-900 dark:text-white">{runtimeStateOverview.servers}</p>
                    </div>
                    <div className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                      <p className="text-xs text-gray-500">{t("运行时")}</p>
                      <p className="text-xl font-semibold text-gray-900 dark:text-white">{runtimeStateOverview.providers}</p>
                    </div>
                    <div className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                      <p className="text-xs text-gray-500">{t("聚合项")}</p>
                      <p className="text-xl font-semibold text-gray-900 dark:text-white">{runtimeStateItems.length}</p>
                    </div>
                    <div className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                      <p className="text-xs text-gray-500">{t("生成时间")}</p>
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{formatTime(runtimeStateOverview.generatedAt)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {recentRuntimeStateItems.map(item => {
                      const targetServer = servers.find(server => server.id === item.serverId);
                      const serviceEntries = Object.entries(item.serviceStatuses || {}).filter(([, value]) => value);
                      const diagnostic = item.diagnosticSummary;
                      const sourceLabel = item.source === "task" ? t("任务结果") : t("服务器心跳");
                      const diagnosticAction = runtimeProviderDiagnosticAction(item, agentMaintenanceActions);
                      const repairAction = runtimeProviderRepairAction(item, agentMaintenanceActions);
                      const stateSyncMeta = {
                        trigger: "state-sync",
                        runtimeProvider: item.providerKey,
                        providerName: item.providerName,
                        runtimeStatus: item.status,
                        statusSource: item.statusSource,
                        sourceTaskId: item.taskId,
                        taskState: item.taskState
                      };
                      const detailParts = [
                        item.protocol && item.action ? `${item.protocol} / ${item.action}` : null,
                        item.nodeCount !== undefined ? t("{count} 个节点", { count: item.nodeCount }) : null,
                        item.forwardRuleCount !== undefined ? t("{count} 条转发", { count: item.forwardRuleCount }) : null,
                        item.certificateStatus ? [item.certificateStatus, item.certificateDomain].filter(Boolean).join(" ") : null
                      ].filter(Boolean);

                      return (
                        <div key={`${item.serverId}-${item.providerKey}-${item.taskId || item.source || "state"}`} className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.2fr)_minmax(180px,.8fr)_minmax(260px,1.3fr)_auto] lg:items-center">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Chip size="sm" variant="flat" color={runtimeProviderColor(item.providerKey) as any}>{item.providerKey}</Chip>
                                <Chip size="sm" variant="flat" color={runtimeStateColor(item.status) as any}>{item.status || "-"}</Chip>
                                <Chip size="sm" variant="flat">{sourceLabel}</Chip>
                              </div>
                              <p className="mt-2 truncate font-semibold text-gray-900 dark:text-white">{item.serverName || `#${item.serverId}`}</p>
                              <p className="truncate text-xs text-gray-500">{item.providerName || item.providerKey}</p>
                            </div>
                            <div className="text-sm">
                              <p className="text-xs text-gray-500">{t("来源")}</p>
                              <p className="truncate text-gray-900 dark:text-white">{item.statusSource || "-"}</p>
                              <p className="text-xs text-gray-500">{formatTime(item.stateUpdatedAt || item.taskUpdatedAt || item.lastHeartbeat)}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm text-gray-900 dark:text-white">{detailParts.length > 0 ? detailParts.join(" · ") : t("等待 Agent 回报")}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.taskId && <Chip size="sm" variant="flat">{t("任务 #{id}", { id: item.taskId })}</Chip>}
                                {item.resourceType && (
                                  <Chip size="sm" variant="flat">
                                    {[item.resourceType, item.resourceId].filter(Boolean).join(" #")}
                                  </Chip>
                                )}
                                {item.danger && <Chip size="sm" variant="flat" color="danger">{t("危险动作")}</Chip>}
                                {serviceEntries.map(([name, status]) => (
                                  <Chip key={name} size="sm" variant="flat" color={runtimeStateColor(status) as any}>{name} {status}</Chip>
                                ))}
                                {diagnostic && (
                                  <Chip size="sm" variant="flat" color={(diagnostic.fail || 0) > 0 ? "danger" : (diagnostic.warning || 0) > 0 ? "warning" : "success"}>
                                    {t("诊断 {fail}/{warning}/{ok}", {
                                      fail: diagnostic.fail || 0,
                                      warning: diagnostic.warning || 0,
                                      ok: diagnostic.ok || 0
                                    })}
                                  </Chip>
                                )}
                              </div>
                              {item.lastError && <p className="mt-1 truncate text-xs text-danger">{item.lastError}</p>}
                            </div>
                            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                              <Chip size="sm" variant="flat">{item.taskState || item.source || "-"}</Chip>
                              <Button
                                size="sm"
                                variant="flat"
                                isDisabled={!targetServer || submitting}
                                onPress={() => targetServer ? createAgentMaintenance(targetServer, diagnosticAction, stateSyncMeta) : toast.error(t("缺少服务器"))}
                              >
                                {t(diagnosticAction.label || "运行时诊断")}
                              </Button>
                              {repairAction && (
                                <Button
                                  size="sm"
                                  color={runtimeProviderActionColor(repairAction) as any}
                                  variant="flat"
                                  isDisabled={!targetServer || submitting}
                                  onPress={() => targetServer ? createAgentMaintenance(targetServer, repairAction, stateSyncMeta) : toast.error(t("缺少服务器"))}
                                >
                                  {t(repairAction.label || "运行时修复")}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {runtimeStateItems.length > recentRuntimeStateItems.length && (
                    <p className="text-xs text-gray-500">
                      {t("仅显示最近 {shown} 条，后端已聚合 {total} 条运行时状态。", { shown: recentRuntimeStateItems.length, total: runtimeStateItems.length })}
                    </p>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </section>

        <section data-testid="runtime-provider">
          <Card radius="sm">
            <CardHeader className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("Runtime Provider 层")}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t("主控按运行时边界分派任务：Xray 入站/出站、Snell、转发、证书和防火墙统一进入 agent 执行链。")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="flat" color="primary">{t("{count} 个运行时", { count: runtimeProviders.length })}</Chip>
                <Chip size="sm" variant="flat">{t("{count} 个活跃任务", { count: Object.values(runtimeProviderActiveTasks).reduce((sum, count) => sum + count, 0) })}</Chip>
              </div>
            </CardHeader>
            <CardBody>
              {runtimeProviders.length === 0 ? (
                <div className="rounded-small border border-dashed border-default-300 p-5 text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{t("Runtime Provider 尚未加载")}</p>
                  <p className="text-sm text-gray-500 mt-1">{t("刷新后会显示 Xray、Snell、转发、证书和防火墙运行时注册表。")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {runtimeProviders.map(provider => (
                    <div key={provider.key} className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{provider.name}</p>
                          <p className="mt-1 truncate text-[11px] text-gray-500">{provider.runtimeType}</p>
                        </div>
                        <Chip size="sm" variant="flat" color={runtimeProviderColor(provider.key) as any}>{provider.key}</Chip>
                      </div>
                      <p className="mt-3 min-h-14 text-xs leading-5 text-gray-500">{provider.summary}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500">{t("执行器")}</p>
                          <p className="truncate text-gray-900 dark:text-white">{provider.executor}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t("任务")}</p>
                          <p className="text-gray-900 dark:text-white">{runtimeProviderTaskCounts[provider.key] || 0} / {runtimeProviderActiveTasks[provider.key] || 0}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {provider.agentRequired && <Chip size="sm" variant="flat">{t("Agent 执行")}</Chip>}
                        {provider.masterApiSupported && <Chip size="sm" variant="flat" color="primary">{t("主控 API")}</Chip>}
                        {provider.nanoSupported && <Chip size="sm" variant="flat" color="success">{t("Nano 支持")}</Chip>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        <section data-testid="monitor-alerts">
          <Card radius="sm">
            <CardHeader className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("监控告警")}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t("{active} 条待确认，{critical} 条严重，来自 agent 心跳、证书、服务状态、任务和流量异常", { active: activeAlerts, critical: criticalAlerts })}
                </p>
              </div>
              <Button size="sm" variant="light" onPress={loadData}>{t("刷新")}</Button>
            </CardHeader>
            <CardBody className="space-y-3">
              {monitorAlerts.length === 0 && (
                <div className="rounded-small border border-dashed border-default-300 p-5 text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{t("当前没有待确认告警")}</p>
                  <p className="text-sm text-gray-500 mt-1">{t("副控心跳、证书、Xray、Snell、任务失败和流量异常会在这里汇总。")}</p>
                </div>
              )}
              {recentAlerts.map(alert => (
                <div key={alert.id} className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip size="sm" variant="flat" color={alertSeverityColor(alert.severity) as any}>{alert.severity}</Chip>
                        <Chip size="sm" variant="flat">{alert.alertType}</Chip>
                        <span className="text-xs text-gray-500">{alert.serverName || `#${alert.serverId}`} / {alert.source}</span>
                      </div>
                      <p className="mt-2 truncate font-semibold text-gray-900 dark:text-white">{alert.message}</p>
                      <p className="text-xs text-gray-500">{t("首次 {first}，最近 {last}", { first: formatTime(alert.firstSeenAt), last: formatTime(alert.lastSeenAt) })}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {alert.detailJson && <Button size="sm" variant="flat" onPress={() => showThreeXuiResult(t("告警详情"), alert.detailJson)}>{t("详情")}</Button>}
                      <Button size="sm" color="primary" variant="flat" onPress={() => acknowledgeAlert(alert)}>{t("确认")}</Button>
                    </div>
                  </div>
                </div>
              ))}
              {monitorAlerts.length > recentAlerts.length && (
                <p className="text-xs text-gray-500">{t("仅显示最近 {shown} 条，后端已保留 {total} 条待确认告警。", { shown: recentAlerts.length, total: monitorAlerts.length })}</p>
              )}
            </CardBody>
          </Card>
        </section>

        <section data-testid="operation-audit">
          <Card radius="sm">
            <CardHeader className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("操作审计")}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t("记录主控创建/拒绝/改状态/重试/删除任务、agent 领取任务和执行回报，方便追踪多服务器运维链路。")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="flat">{t("{count} 条记录", { count: operationAuditLogs.length })}</Chip>
                <Button size="sm" variant="light" onPress={loadData}>{t("刷新")}</Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {operationAuditLogs.length === 0 && (
                <div className="rounded-small border border-dashed border-default-300 p-5 text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{t("暂无操作审计")}</p>
                  <p className="text-sm text-gray-500 mt-1">{t("创建部署任务或 agent 回报结果后，这里会显示最近审计事件。")}</p>
                </div>
              )}
              {recentAuditLogs.map(log => (
                <div key={log.id} className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_minmax(260px,1.3fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip size="sm" variant="flat" color={auditOutcomeColor(log.outcome) as any}>{auditOutcomeLabel(log.outcome)}</Chip>
                        <Chip size="sm" variant="flat">{log.eventType}</Chip>
                        {log.danger === 1 && <Chip size="sm" variant="flat" color="danger">{t("危险动作")}</Chip>}
                      </div>
                      <p className="mt-2 truncate font-semibold text-gray-900 dark:text-white">{log.summary || log.eventType}</p>
                      <p className="truncate text-xs text-gray-500">{formatTime(log.createdTime)}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-xs text-gray-500">{t("执行者")}</p>
                      <p className="truncate text-gray-900 dark:text-white">{log.actorName || log.actorId || log.actorType}</p>
                      <p className="truncate text-xs text-gray-500">{log.actorType}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">{t("资源")}</p>
                      <p className="truncate text-sm text-gray-900 dark:text-white">
                        {[log.serverName || (log.serverId ? `#${log.serverId}` : null), log.providerKey, log.action].filter(Boolean).join(" · ") || "-"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {log.resourceType && <Chip size="sm" variant="flat">{log.resourceType}</Chip>}
                        {log.resourceId && <Chip size="sm" variant="flat">#{log.resourceId}</Chip>}
                        {log.providerKey && <Chip size="sm" variant="flat" color={runtimeProviderColor(log.providerKey) as any}>{log.providerKey}</Chip>}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      {log.detailJson && <Button size="sm" variant="flat" onPress={() => showThreeXuiResult(t("审计详情"), log.detailJson || "")}>{t("详情")}</Button>}
                    </div>
                  </div>
                </div>
              ))}
              {operationAuditLogs.length > recentAuditLogs.length && (
                <p className="text-xs text-gray-500">{t("仅显示最近 {shown} 条，后端已保留 {total} 条审计记录。", { shown: recentAuditLogs.length, total: operationAuditLogs.length })}</p>
              )}
            </CardBody>
          </Card>
        </section>

        <section data-testid="unified-rule-center">
          <Card radius="sm">
            <CardHeader className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("统一规则中心")}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t("当前显示 {filtered} / {total} 条，健康 {healthy}，观察 {warning}，异常 {error}", { filtered: filteredRuleRows.length, total: unifiedRuleRows.length, healthy: ruleHealthCounts.healthy, warning: ruleHealthCounts.warning, error: ruleHealthCounts.error })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" color="primary" variant="flat" onPress={() => openProtocolNodeModal()}>{t("新增节点")}</Button>
                <Button size="sm" color="primary" variant="flat" onPress={() => openServerForwardModal()}>{t("新增转发")}</Button>
                <Button size="sm" variant="light" onPress={loadData}>{t("刷新")}</Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Input aria-label={t("搜索规则")} placeholder={t("搜索名称、服务器、端口、目标")} value={ruleSearch} onChange={event => setRuleSearch(event.target.value)} variant="bordered" size="sm" />
                <Select aria-label={t("规则类型")} selectedKeys={[ruleKindFilter]} onSelectionChange={keys => setRuleKindFilter(Array.from(keys)[0] as RuleKindFilter)} variant="bordered" size="sm">
                  <SelectItem key="all">{t("全部类型")}</SelectItem>
                  <SelectItem key="protocol">{t("协议节点")}</SelectItem>
                  <SelectItem key="forward">{t("远端转发")}</SelectItem>
                  <SelectItem key="xui">{t("入站视图")}</SelectItem>
                </Select>
                <Select aria-label={t("规则服务器")} selectedKeys={[ruleServerFilter]} onSelectionChange={keys => setRuleServerFilter(Array.from(keys)[0] as string)} variant="bordered" size="sm">
                  {ruleServerOptions.map(option => <SelectItem key={option.id}>{option.name}</SelectItem>)}
                </Select>
                <Select aria-label={t("规则健康状态")} selectedKeys={[ruleHealthFilter]} onSelectionChange={keys => setRuleHealthFilter(Array.from(keys)[0] as RuleHealthFilter)} variant="bordered" size="sm">
                  <SelectItem key="all">{t("全部状态")}</SelectItem>
                  <SelectItem key="healthy">{t("健康")}</SelectItem>
                  <SelectItem key="warning">{t("观察")}</SelectItem>
                  <SelectItem key="error">{t("异常")}</SelectItem>
                </Select>
              </div>

              {unifiedRuleRows.length === 0 && (
                <div className="rounded-small border border-dashed border-default-300 p-6 text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{t("还没有规则")}</p>
                  <p className="text-sm text-gray-500 mt-1">{t("创建协议节点、添加远端转发或同步远端流量后，这里会汇总展示。")}</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button size="sm" color="primary" variant="flat" onPress={() => openProtocolNodeModal()}>{t("新增节点")}</Button>
                    <Button size="sm" color="primary" variant="flat" onPress={() => openServerForwardModal()}>{t("新增转发")}</Button>
                  </div>
                </div>
              )}

              {unifiedRuleRows.length > 0 && filteredRuleRows.length === 0 && (
                <div className="rounded-small border border-dashed border-default-300 p-6 text-center">
                  <p className="font-medium text-gray-900 dark:text-white">{t("没有匹配的规则")}</p>
                  <p className="text-sm text-gray-500 mt-1">{t("清空搜索或放宽类型、服务器、状态筛选。")}</p>
                  <Button size="sm" variant="flat" className="mt-4" onPress={() => {
                    setRuleSearch("");
                    setRuleKindFilter("all");
                    setRuleServerFilter("all");
                    setRuleHealthFilter("all");
                  }}>
                    {t("重置筛选")}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {filteredRuleRows.map(row => (
                  <div key={row.id} className="rounded-small border border-default-200 bg-white/70 p-3 dark:bg-default-50/5">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_minmax(220px,1.2fr)_minmax(160px,.8fr)_auto] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip size="sm" variant="flat" color={row.kind === "protocol" ? "primary" : row.kind === "forward" ? "secondary" : "success"}>{row.kind === "protocol" ? t("节点") : row.kind === "forward" ? t("转发") : t("入站")}</Chip>
                          <Chip size="sm" variant="flat" color={row.health === "healthy" ? "success" : row.health === "warning" ? "warning" : "danger"}>{row.status}</Chip>
                        </div>
                        <p className="mt-2 truncate font-semibold text-gray-900 dark:text-white">{row.title}</p>
                        <p className="truncate text-xs text-gray-500">{row.serverName} / {row.detail}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-gray-500">{t("协议")}</p><p className="truncate">{row.protocol || "-"}</p></div>
                        <div><p className="text-xs text-gray-500">{t("流量")}</p><p>{formatBytes(row.traffic)}</p></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="min-w-0"><p className="text-xs text-gray-500">{t("监听 / 入站")}</p><p className="truncate">{row.endpoint}</p></div>
                        <div className="min-w-0"><p className="text-xs text-gray-500">{t("目标 / 客户端")}</p><p className="truncate">{row.target}</p></div>
                      </div>
                      <div className="text-sm">
                        <p className="text-xs text-gray-500">{t("最近同步")}</p>
                        <p>{formatTime(row.syncedAt)}</p>
                        {row.error && <p className="mt-1 truncate text-xs text-danger">{row.error}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <Button size="sm" variant="flat" onPress={() => copyRuleData(row)}>{t("复制")}</Button>
                        {row.node && (
                          <>
                            <Button size="sm" variant="flat" onPress={() => openProtocolNodeModal(undefined, row.node!)}>{t("编辑")}</Button>
                            <Button size="sm" variant="flat" onPress={() => restartNode(row.node!)}>{t("重启")}</Button>
                            <Button size="sm" variant="light" color="danger" onPress={() => removeProtocolNode(row.node!)}>{t("删除")}</Button>
                          </>
                        )}
                        {row.rule && (
                          <>
                            <Button size="sm" variant="flat" onPress={() => openServerForwardModal(undefined, row.rule!)}>{t("编辑")}</Button>
                            <Button size="sm" variant="flat" onPress={() => restartForwardRule(row.rule!)}>{t("重启")}</Button>
                            <Button size="sm" variant="light" color="danger" onPress={() => removeServerForwardRule(row.rule!)}>{t("删除")}</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </section>

        <section data-testid="server-list">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("服务器")}</h2>
            <Button size="sm" variant="light" onPress={loadData}>{t("刷新")}</Button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {servers.map(server => (
              <Card key={server.id} radius="sm" data-testid={`server-card-${server.id}`}>
                <CardHeader className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{server.name}</p>
                    <p className="text-xs text-gray-500">{server.host}:{server.sshPort || 22}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Chip color={server.role === "master" ? "warning" : "default"} variant="flat" size="sm">
                      {server.role === "master" ? t("主控") : t("副控")}
                    </Chip>
                    {isLowMemoryServer(server) && (
                      <Chip color={isNanoCriticalServer(server) ? "danger" : "warning"} variant="flat" size="sm">
                        {t("Nano 被控")}
                      </Chip>
                    )}
                    <Chip color={heartbeatColor(server) as any} variant="flat" size="sm">{heartbeatText(server)}</Chip>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  {server.role === "master" && (
                    <MasterRiskNotice context="在该卡片执行一键编排、入站/出站保存或重启" />
                  )}
                  {isLowMemoryServer(server) && (
                    <div className="rounded-small border border-warning-300 bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
                      <span className="font-semibold">{t("超小内存提示：")}</span>
                      {t("该被控总内存约 {memory} MB，完整 Xray 编排可能 OOM；优先使用 Snell、远端端口转发或先开启 swap。", {
                        memory: server.memoryTotalMb || "-"
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">{t("入口")}</p>
                      <p className="truncate">{server.endpoint || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t("面板入口")}</p>
                      <p className="truncate">{server.xuiEndpoint || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Agent</p>
                      <p>{server.agentVersion || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Xray</p>
                      <p>{server.xrayVersion || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Snell</p>
                      <p>{server.snellVersion || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">CPU</p>
                      <p>{server.cpuUsage == null ? "-" : `${server.cpuUsage.toFixed(1)}%`}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t("内存")}</p>
                      <p>
                        {server.memoryUsage == null ? "-" : `${server.memoryUsage.toFixed(1)}%`}
                        {server.memoryTotalMb ? ` / ${server.memoryTotalMb} MB` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t("上传")}</p>
                      <p>{formatBytes(server.uploadTraffic)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t("下载")}</p>
                      <p>{formatBytes(server.downloadTraffic)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip size="sm" variant="flat" color={serviceColor(server.xuiServiceStatus) as any}>{t("面板")} {server.xuiServiceStatus || "-"}</Chip>
                    <Chip size="sm" variant="flat" color={serviceColor(server.xrayServiceStatus) as any}>Xray {server.xrayServiceStatus || "-"}</Chip>
                    <Chip size="sm" variant="flat" color={serviceColor(server.snellServiceStatus) as any}>Snell {server.snellServiceStatus || "-"}</Chip>
                    <Chip size="sm" variant="flat" color={serviceColor(server.certificateStatus) as any}>{certificateText(server)}</Chip>
                  </div>
                  <p className="text-xs text-gray-500">{t("心跳：{time}", { time: formatTime(server.lastHeartbeat) })}</p>
                  <p className="text-xs text-gray-500">{t("规则同步：{time}", { time: formatTime(server.xuiLastSync) })}</p>
                  {server.certificateExpireAt && <p className="text-xs text-gray-500">{t("证书到期：{time}", { time: formatTime(server.certificateExpireAt) })}</p>}
                  {server.lastError && <p className="text-xs text-danger">{t("最近错误：{error}", { error: server.lastError })}</p>}
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <ServerActionGroup title="编排">
                      <Button size="sm" color="primary" variant="flat" onPress={() => openOrchestrationModal(server)}>{t("一键编排")}</Button>
                      <Button size="sm" color="primary" variant="flat" onPress={() => openProtocolNodeModal(server)}>{t("新增节点")}</Button>
                      <Button size="sm" color="primary" variant="flat" onPress={() => openServerForwardModal(server)}>{t("新增转发")}</Button>
                      <Button size="sm" variant="flat" onPress={() => openDeployModal(server)}>{t("部署")}</Button>
                    </ServerActionGroup>
                    <ServerActionGroup title="规则流量">
                      <Button size="sm" variant="flat" onPress={() => showServerRuleOverview(server)}>{t("规则总览")}</Button>
                      <Button size="sm" variant="flat" onPress={() => syncServerProtocolNodes(server)}>{t("同步节点")}</Button>
                      <Button size="sm" variant="flat" onPress={() => syncXuiTraffic(server)}>{t("同步流量")}</Button>
                      <Button size="sm" variant="flat" onPress={() => showTrafficSnapshots(server)}>{t("流量快照")}</Button>
                    </ServerActionGroup>
                    <ServerActionGroup title={t("入站/出站")} testId={`xray-runtime-actions-${server.id}`}>
                      <Button size="sm" variant="flat" onPress={() => testXui(server)}>{t("连接测试")}</Button>
                      <Button size="sm" variant="flat" onPress={() => showThreeXuiInbounds(server)}>{t("入站")}</Button>
                      <Button size="sm" variant="flat" onPress={() => openThreeXuiInboundModal(server)}>{t("入站操作")}</Button>
                      <Button size="sm" variant="flat" onPress={() => showThreeXuiConfig(server)}>{t("Xray 配置")}</Button>
                      <Button size="sm" variant="flat" onPress={() => showThreeXuiOutbounds(server)}>{t("出站")}</Button>
                      <Button size="sm" variant="flat" onPress={() => showThreeXuiOutboundTraffic(server)}>{t("出站流量")}</Button>
                      <Button size="sm" variant="flat" onPress={() => openXraySettingModal(server)}>{t("路由/出站")}</Button>
                      <Button size="sm" variant="flat" onPress={() => restartXray(server)}>{t("重启 Xray")}</Button>
                    </ServerActionGroup>
                    <ServerActionGroup title="Agent" testId={`agent-actions-${server.id}`}>
                      {serverAgentActions.map(action => (
                        <Button
                          key={action.key}
                          size="sm"
                          variant={action.danger ? "light" : "flat"}
                          color={runtimeProviderActionColor(action) as any}
                          onPress={() => createAgentMaintenance(server, action)}
                        >
                          {t(action.label || action.key)}
                        </Button>
                      ))}
                    </ServerActionGroup>
                    <ServerActionGroup title="管理">
                      <Button size="sm" variant="flat" onPress={() => openServerModal(server)}>{t("编辑")}</Button>
                      <Button size="sm" variant="flat" onPress={() => showServerToken(server)}>Token</Button>
                      <Button size="sm" variant="flat" color="warning" onPress={() => showServerToken(server, true)}>{t("轮换")}</Button>
                      <Button size="sm" variant="light" color="danger" onPress={() => removeServer(server)}>{t("删除")}</Button>
                    </ServerActionGroup>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("协议节点")}</h2>
            <Button size="sm" variant="light" onPress={() => openProtocolNodeModal()}>{t("新增节点")}</Button>
          </div>
          {protocolNodes.length === 0 ? (
            <div className="rounded-small border border-dashed border-default-300 bg-white/60 px-4 py-6 dark:bg-default-50/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("还没有协议节点")}</p>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">{t("先新增一个结构化节点，或用一键编排批量创建 Xray/Snell 节点。")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" color="primary" variant="flat" onPress={() => openProtocolNodeModal()}>{t("新增节点")}</Button>
                  <Button size="sm" variant="flat" onPress={() => openOrchestrationModal()}>{t("一键编排")}</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {protocolNodes.map(node => (
                <Card key={node.id} radius="sm">
                  <CardBody className="space-y-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{node.name}</p>
                        <p className="text-xs text-gray-500">{node.serverName || node.serverId} / {node.direction || "inbound"}</p>
                      </div>
                      <Chip size="sm" variant="flat" color={serviceColor(node.state) as any}>{node.state || "-"}</Chip>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">{t("引擎")}</p>
                        <p>{node.engine}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t("协议")}</p>
                        <p>{node.protocol}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t("端口")}</p>
                        <p>{node.listen || "*"}:{node.port || "-"}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t("流量")}</p>
                        <p>{formatBytes(node.total || ((node.up || 0) + (node.down || 0)))}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{t("远端：{value}", { value: node.remoteId || node.serviceName || "-" })}</p>
                    <p className="text-xs text-gray-500">{t("同步：{time}", { time: formatTime(node.lastSync) })}</p>
                    {node.lastError && <p className="text-xs text-danger">{t("错误：{error}", { error: node.lastError })}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="flat" onPress={() => openProtocolNodeModal(undefined, node)}>{t("编辑")}</Button>
                      <Button size="sm" variant="flat" onPress={() => restartNode(node)}>{t("重启")}</Button>
                      <Button size="sm" variant="light" color="danger" onPress={() => removeProtocolNode(node)}>{t("删除")}</Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("远端端口转发")}</h2>
            <Button size="sm" variant="light" onPress={() => openServerForwardModal()}>{t("新增转发")}</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {forwardRules.map(rule => (
              <Card key={rule.id} radius="sm">
                <CardBody className="space-y-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{rule.name}</p>
                      <p className="text-xs text-gray-500">{rule.serverName || rule.serverId} / {rule.protocol || "tcp"}</p>
                    </div>
                    <Chip size="sm" variant="flat" color={serviceColor(rule.state) as any}>{rule.state || "-"}</Chip>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">{t("监听")}</p>
                      <p>{rule.listenHost || "0.0.0.0"}:{rule.listenPort}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t("目标")}</p>
                      <p className="truncate">{rule.targetHost}:{rule.targetPort}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t("引擎")}</p>
                      <p>{rule.engine || "socat"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t("流量")}</p>
                      <p>{formatBytes((rule.up || 0) + (rule.down || 0))}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{t("服务：{value}", { value: rule.serviceName || "-" })}</p>
                  <p className="text-xs text-gray-500">{t("同步：{time}", { time: formatTime(rule.lastSync) })}</p>
                  {rule.lastError && <p className="text-xs text-danger">{t("错误：{error}", { error: rule.lastError })}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => openServerForwardModal(undefined, rule)}>{t("编辑")}</Button>
                    <Button size="sm" variant="flat" onPress={() => restartForwardRule(rule)}>{t("重启")}</Button>
                    <Button size="sm" variant="light" color="danger" onPress={() => removeServerForwardRule(rule)}>{t("删除")}</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("协议模板")}</h2>
            <Button size="sm" variant="light" onPress={() => openProfileModal()}>{t("新增节点")}</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {profiles.map(profile => (
              <Card key={profile.id} radius="sm">
                <CardBody className="space-y-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{profile.name}</p>
                      <p className="text-xs text-gray-500">{profile.protocol} / {profile.transport || "tcp"}</p>
                    </div>
                    <Chip size="sm" variant="flat">{profile.versionFamily || "xray"}</Chip>
                  </div>
                  <p className="text-sm text-gray-500 min-h-10">{profile.remark || "-"}</p>
                  <p className="text-sm">{t("端口")}：{profile.listenPort || "-"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => openProfileModal(profile)}>{t("编辑")}</Button>
                    <Button size="sm" variant="light" color="danger" onPress={() => removeProfile(profile)}>{t("删除")}</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("部署任务")}</h2>
            <Button size="sm" variant="light" onPress={() => openDeployModal()}>{t("生成")}</Button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {tasks.map(task => (
              <Card key={task.id} radius="sm">
                <CardBody className="space-y-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">#{task.id} {task.serverName || task.serverId}</p>
                      <p className="text-xs text-gray-500">{task.protocol} / {task.action}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {task.runtimeProvider && (
                        <Chip size="sm" variant="flat" color={runtimeProviderColor(task.runtimeProvider.key) as any}>
                          {task.runtimeProvider.key}
                        </Chip>
                      )}
                      <Chip size="sm" variant="flat" color={task.state === "succeeded" ? "success" : task.state === "failed" ? "danger" : "primary"}>
                        {task.state}
                      </Chip>
                    </div>
                  </div>
                  {task.runtimeProvider && (
                    <div className="rounded-small border border-default-200 bg-default-50/60 px-3 py-2 text-xs dark:bg-default-50/5">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{task.runtimeProvider.name}</span>
                        <span className="text-gray-500">{task.runtimeProvider.executor} / {task.runtimeProvider.stateSource}</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">{t("创建：{time}", { time: formatTime(task.createdTime) })}</p>
                  <RuntimeStatePanel task={task} />
                  <DiagnosticSummaryPanel task={task} onShowResult={showTaskResult} />
                  <AgentUpgradePanel task={task} onShowResult={showTaskResult} />
                  <RemoteLogsPanel task={task} onShowResult={showTaskResult} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => showTaskScript(task)}>{t("脚本")}</Button>
                    {task.resultJson && (
                      <Button size="sm" variant="flat" onPress={() => showTaskResult(task)}>{t("原始结果")}</Button>
                    )}
                    {["failed", "timeout"].includes(task.state) && (
                      <Button size="sm" variant="flat" color="warning" onPress={() => retryTask(task)}>{t("重试")}</Button>
                    )}
                    <Button size="sm" variant="light" color="danger" onPress={() => removeTask(task)}>{t("删除")}</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <Modal isOpen={serverModalOpen} onOpenChange={setServerModalOpen} size="4xl">
        <ModalContent>
          <ModalHeader>{serverForm.id ? t("编辑服务器") : t("添加服务器")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t("名称")} value={serverForm.name} onChange={e => setServerForm(prev => ({ ...prev, name: e.target.value }))} variant="bordered" />
              <Select label={t("角色")} selectedKeys={[serverForm.role]} onSelectionChange={keys => setServerForm(prev => ({ ...prev, role: Array.from(keys)[0] as string }))} variant="bordered">
                <SelectItem key="master">{t("主控")}</SelectItem>
                <SelectItem key="agent">{t("副控")}</SelectItem>
              </Select>
              <Input label={t("主机")} value={serverForm.host} onChange={e => setServerForm(prev => ({ ...prev, host: e.target.value }))} variant="bordered" />
              <Input label="SSH 端口" type="number" value={serverForm.sshPort.toString()} onChange={e => setServerForm(prev => ({ ...prev, sshPort: Number(e.target.value) || 22 }))} variant="bordered" />
              <Input label="SSH 用户" value={serverForm.sshUser} onChange={e => setServerForm(prev => ({ ...prev, sshUser: e.target.value }))} variant="bordered" />
              <Input label={t("副控 API")} value={serverForm.endpoint} onChange={e => setServerForm(prev => ({ ...prev, endpoint: e.target.value }))} variant="bordered" />
              <Input label={t("面板地址")} value={serverForm.xuiEndpoint} onChange={e => setServerForm(prev => ({ ...prev, xuiEndpoint: e.target.value }))} variant="bordered" placeholder="https://1.2.3.4:5168" />
              <Input label={t("面板 Base Path")} value={serverForm.xuiBasePath} onChange={e => setServerForm(prev => ({ ...prev, xuiBasePath: e.target.value }))} variant="bordered" placeholder="/secret-path" />
              <Input label={t("面板 API Token")} value={serverForm.xuiApiToken} onChange={e => setServerForm(prev => ({ ...prev, xuiApiToken: e.target.value }))} variant="bordered" />
              <Input label={t("面板用户名")} value={serverForm.xuiUsername} onChange={e => setServerForm(prev => ({ ...prev, xuiUsername: e.target.value }))} variant="bordered" />
              <Input label={t("面板密码")} type="password" value={serverForm.xuiPassword} onChange={e => setServerForm(prev => ({ ...prev, xuiPassword: e.target.value }))} variant="bordered" />
              <Input label={t("面板 2FA")} value={serverForm.xuiTwoFactorCode} onChange={e => setServerForm(prev => ({ ...prev, xuiTwoFactorCode: e.target.value }))} variant="bordered" />
              <Select label={t("面板 TLS 校验")} selectedKeys={[serverForm.xuiAllowInsecure.toString()]} onSelectionChange={keys => setServerForm(prev => ({ ...prev, xuiAllowInsecure: Number(Array.from(keys)[0]) }))} variant="bordered">
                <SelectItem key="0">{t("校验证书")}</SelectItem>
                <SelectItem key="1">{t("允许自签名")}</SelectItem>
              </Select>
            </div>
            {serverForm.role === "master" && (
              <MasterRiskNotice context="保存 role=master" />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setServerModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveServer}>{t("保存")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={profileModalOpen} onOpenChange={setProfileModalOpen} size="3xl">
        <ModalContent>
          <ModalHeader>{profileForm.id ? t("编辑协议模板") : t("添加协议模板")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t("名称")} value={profileForm.name} onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))} variant="bordered" />
              <Input label={t("协议")} value={profileForm.protocol} onChange={e => setProfileForm(prev => ({ ...prev, protocol: e.target.value }))} variant="bordered" />
              <Input label={t("版本族")} value={profileForm.versionFamily} onChange={e => setProfileForm(prev => ({ ...prev, versionFamily: e.target.value }))} variant="bordered" />
              <Input label={t("端口")} type="number" value={profileForm.listenPort.toString()} onChange={e => setProfileForm(prev => ({ ...prev, listenPort: Number(e.target.value) || 0 }))} variant="bordered" />
              <Input label={t("传输")} value={profileForm.transport} onChange={e => setProfileForm(prev => ({ ...prev, transport: e.target.value }))} variant="bordered" />
              <Input label={t("备注")} value={profileForm.remark} onChange={e => setProfileForm(prev => ({ ...prev, remark: e.target.value }))} variant="bordered" />
            </div>
            <Textarea label={t("配置 JSON")} minRows={5} value={profileForm.configJson} onChange={e => setProfileForm(prev => ({ ...prev, configJson: e.target.value }))} variant="bordered" />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setProfileModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveProfile}>{t("保存")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={protocolNodeModalOpen} onOpenChange={setProtocolNodeModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{protocolNodeForm.id ? t("编辑协议节点") : t("新增协议节点")}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="rounded-small border border-default-200 bg-default-50/60 p-3 dark:bg-default-50/5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("配置体检")}</p>
                    <p className="mt-1 text-xs text-gray-500">{t("保存前检查目标服务器、端口、凭据和协议关键参数。")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip size="sm" variant="flat" color="primary">{protocolNodeForm.protocol.toUpperCase()}</Chip>
                    <Chip size="sm" variant="flat">{protocolNodeForm.engine}</Chip>
                    <Chip size="sm" variant="flat">{protocolNodeForm.security}</Chip>
                    <Chip size="sm" variant="flat">{selectedProtocolServer?.name || t("未选择服务器")}</Chip>
                    <Chip size="sm" variant="flat" color={protocolNodeCheckSummary.color as any}>
                      {t("{ok}/{total} 通过", { ok: protocolNodeCheckSummary.ok, total: protocolNodeCheckSummary.total })}
                    </Chip>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {protocolNodeChecks.map((check, index) => (
                    <div key={`${check.label}-${index}`} className="rounded-small border border-default-200 bg-white/70 px-3 py-2 dark:bg-default-50/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{check.label}</span>
                        <Chip size="sm" variant="flat" color={formCheckColor(check.state) as any}>
                          {check.state === "ok" ? t("通过") : check.state === "warning" ? t("需确认") : t("缺失")}
                        </Chip>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{check.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label={t("目标服务器")} selectedKeys={protocolNodeForm.serverId ? [protocolNodeForm.serverId.toString()] : []} onSelectionChange={keys => patchProtocolNodeForm({ serverId: Number(Array.from(keys)[0]) })} variant="bordered">
                  {renderServerOptions()}
                </Select>
                <Input label={t("节点名称")} value={protocolNodeForm.name} onChange={e => patchProtocolNodeForm({ name: e.target.value })} variant="bordered" />
                <Select label={t("协议")} selectedKeys={[protocolNodeForm.protocol]} onSelectionChange={keys => updateProtocolNodeProtocol(Array.from(keys)[0] as ProtocolNodeForm["protocol"])} variant="bordered">
                  <SelectItem key="vless">VLESS Reality</SelectItem>
                  <SelectItem key="vmess">VMess WS</SelectItem>
                  <SelectItem key="trojan">Trojan TLS</SelectItem>
                  <SelectItem key="shadowsocks">Shadowsocks</SelectItem>
                  <SelectItem key="snell">Snell</SelectItem>
                </Select>
                <Input label={t("监听地址")} value={protocolNodeForm.listen} onChange={e => patchProtocolNodeForm({ listen: e.target.value })} variant="bordered" placeholder={protocolNodeForm.protocol === "snell" ? "::0" : t("留空监听全部")} />
                <Input label={t("端口")} type="number" value={protocolNodeForm.port.toString()} onChange={e => patchProtocolNodeForm({ port: Number(e.target.value) || 0 })} variant="bordered" />
                <Select label={t("传输")} selectedKeys={[protocolNodeForm.transport]} onSelectionChange={keys => patchProtocolNodeForm({ transport: Array.from(keys)[0] as ProtocolNodeForm["transport"] })} variant="bordered" isDisabled={protocolNodeForm.protocol === "snell"}>
                  <SelectItem key="tcp">TCP</SelectItem>
                  <SelectItem key="ws">WebSocket</SelectItem>
                </Select>
                <Select label={t("安全")} selectedKeys={[protocolNodeForm.security]} onSelectionChange={keys => patchProtocolNodeForm({ security: Array.from(keys)[0] as ProtocolNodeForm["security"] })} variant="bordered" isDisabled={protocolNodeForm.protocol === "snell"}>
                  <SelectItem key="none">None</SelectItem>
                  <SelectItem key="tls">TLS</SelectItem>
                  <SelectItem key="reality">Reality</SelectItem>
                  <SelectItem key="psk">PSK</SelectItem>
                </Select>
              </div>
              {selectedProtocolServer?.role === "master" && (
                <MasterRiskNotice context="保存该协议节点" />
              )}

              {protocolNodeForm.protocol === "snell" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Input label="Snell PSK" value={protocolNodeForm.snellPsk} onChange={e => patchProtocolNodeForm({ snellPsk: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                    <Button size="sm" variant="flat" onPress={() => patchProtocolNodeForm({ snellPsk: randomToken(32) })}>{t("生成 PSK")}</Button>
                  </div>
                  <Input label={t("Snell 版本")} value={protocolNodeForm.snellVersion} onChange={e => patchProtocolNodeForm({ snellVersion: e.target.value })} variant="bordered" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label={t("客户端 Email")} value={protocolNodeForm.clientEmail} onChange={e => patchProtocolNodeForm({ clientEmail: e.target.value })} variant="bordered" />
                    {protocolNodeForm.protocol !== "trojan" && protocolNodeForm.protocol !== "shadowsocks" && (
                      <div className="space-y-2">
                        <Input label={t("客户端 UUID")} value={protocolNodeForm.clientId} onChange={e => patchProtocolNodeForm({ clientId: e.target.value })} variant="bordered" />
                        <Button size="sm" variant="flat" onPress={() => patchProtocolNodeForm({ clientId: randomUuid() })}>{t("生成 UUID")}</Button>
                      </div>
                    )}
                    {(protocolNodeForm.protocol === "trojan" || protocolNodeForm.protocol === "shadowsocks") && (
                      <Input label={t("客户端密码 / PSK")} value={protocolNodeForm.clientPassword} onChange={e => patchProtocolNodeForm({ clientPassword: e.target.value })} variant="bordered" />
                    )}
                    {protocolNodeForm.protocol === "vless" && (
                      <Input label="Flow" value={protocolNodeForm.flow} onChange={e => patchProtocolNodeForm({ flow: e.target.value })} variant="bordered" />
                    )}
                    <Input label={t("流量限制 GB")} type="number" value={protocolNodeForm.totalGb.toString()} onChange={e => patchProtocolNodeForm({ totalGb: Number(e.target.value) || 0 })} variant="bordered" />
                    <Input label={t("有效期天数")} type="number" value={protocolNodeForm.expiryDays.toString()} onChange={e => patchProtocolNodeForm({ expiryDays: Number(e.target.value) || 0 })} variant="bordered" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="SNI / Host" value={protocolNodeForm.sni} onChange={e => patchProtocolNodeForm({ sni: e.target.value })} variant="bordered" />
                    {protocolNodeForm.protocol === "vless" && protocolNodeForm.security === "reality" && (
                      <>
                        <Input label="Reality Dest" value={protocolNodeForm.realityDest} onChange={e => patchProtocolNodeForm({ realityDest: e.target.value })} variant="bordered" />
                        <div className="space-y-2">
                          <Input label="Reality Private Key" value={protocolNodeForm.realityPrivateKey} onChange={e => patchProtocolNodeForm({ realityPrivateKey: e.target.value })} variant="bordered" />
                          <Button size="sm" variant="flat" onPress={() => patchProtocolNodeForm({ realityPrivateKey: randomRealityPrivateKey() })}>{t("生成私钥")}</Button>
                        </div>
                        <div className="space-y-2">
                          <Input label="Reality Short ID" value={protocolNodeForm.realityShortId} onChange={e => patchProtocolNodeForm({ realityShortId: e.target.value })} variant="bordered" />
                          <Button size="sm" variant="flat" onPress={() => patchProtocolNodeForm({ realityShortId: randomHex(8) })}>{t("生成 Short ID")}</Button>
                        </div>
                      </>
                    )}
                    {protocolNodeForm.protocol === "vmess" && (
                      <Input label="WebSocket Path" value={protocolNodeForm.wsPath} onChange={e => patchProtocolNodeForm({ wsPath: e.target.value })} variant="bordered" />
                    )}
                    {protocolNodeForm.protocol === "shadowsocks" && (
                      <Input label={t("加密方法")} value={protocolNodeForm.ssMethod} onChange={e => patchProtocolNodeForm({ ssMethod: e.target.value })} variant="bordered" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input label="Outbound Tag" value={protocolNodeForm.outboundTag} onChange={e => patchProtocolNodeForm({ outboundTag: e.target.value })} variant="bordered" placeholder={t("留空使用默认路由")} />
                    {renderOutboundTagButtons(tag => patchProtocolNodeForm({ outboundTag: tag }))}
                  </div>
                  <div className="rounded-small border border-default-200 bg-default-50/50 p-3 dark:bg-default-50/5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("高级 Payload 预览")}</p>
                        <p className="text-xs text-gray-500">{t("默认使用结构化表单；排查入站字段时再展开 JSON。")}</p>
                      </div>
                      <Button size="sm" variant="flat" onPress={() => setProtocolNodePreviewOpen(open => !open)}>
                        {protocolNodePreviewOpen ? t("收起") : t("展开")}
                      </Button>
                    </div>
                    {protocolNodePreviewOpen && (
                      <Textarea
                        className="mt-3"
                        label={t("Inbound Payload 预览")}
                        minRows={10}
                        value={protocolNodePayloadPreview(protocolNodeForm)}
                        readOnly
                        variant="bordered"
                        classNames={{ input: "font-mono text-xs" }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setProtocolNodeModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveProtocolNode}>{t("保存")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={serverForwardModalOpen} onOpenChange={setServerForwardModalOpen} size="3xl">
        <ModalContent>
          <ModalHeader>{serverForwardRuleForm.id ? t("编辑远端端口转发") : t("新增远端端口转发")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t("目标服务器")} selectedKeys={serverForwardRuleForm.serverId ? [serverForwardRuleForm.serverId.toString()] : []} onSelectionChange={keys => patchServerForwardRuleForm({ serverId: Number(Array.from(keys)[0]) })} variant="bordered">
                {renderServerOptions()}
              </Select>
              <Input label={t("规则名称")} value={serverForwardRuleForm.name} onChange={e => patchServerForwardRuleForm({ name: e.target.value })} variant="bordered" />
              <Select label={t("协议")} selectedKeys={[serverForwardRuleForm.protocol]} onSelectionChange={keys => patchServerForwardRuleForm({ protocol: Array.from(keys)[0] as ServerForwardRuleForm["protocol"] })} variant="bordered">
                <SelectItem key="tcp">TCP</SelectItem>
                <SelectItem key="udp">UDP</SelectItem>
              </Select>
              <Input label={t("监听地址")} value={serverForwardRuleForm.listenHost} onChange={e => patchServerForwardRuleForm({ listenHost: e.target.value })} variant="bordered" />
              <Input label={t("监听端口")} type="number" value={serverForwardRuleForm.listenPort.toString()} onChange={e => patchServerForwardRuleForm({ listenPort: Number(e.target.value) || 0 })} variant="bordered" />
              <Input label={t("目标地址")} value={serverForwardRuleForm.targetHost} onChange={e => patchServerForwardRuleForm({ targetHost: e.target.value })} variant="bordered" />
              <Input label={t("目标端口")} type="number" value={serverForwardRuleForm.targetPort.toString()} onChange={e => patchServerForwardRuleForm({ targetPort: Number(e.target.value) || 0 })} variant="bordered" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setServerForwardModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveServerForwardRule}>{t("保存")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={deployModalOpen} onOpenChange={setDeployModalOpen} size="2xl">
        <ModalContent>
          <ModalHeader>{t("生成部署任务")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t("目标服务器")} selectedKeys={deployForm.serverId ? [deployForm.serverId.toString()] : []} onSelectionChange={keys => setDeployForm(prev => ({ ...prev, serverId: Number(Array.from(keys)[0]) }))} variant="bordered">
                {renderServerOptions()}
              </Select>
              <Select label={t("协议模板")} selectedKeys={deployForm.profileId ? [deployForm.profileId.toString()] : []} onSelectionChange={keys => selectProfileForDeploy(Number(Array.from(keys)[0]))} variant="bordered">
                {profiles.map(profile => <SelectItem key={profile.id.toString()}>{profile.name}</SelectItem>)}
              </Select>
              <Select label={t("动作")} selectedKeys={[deployForm.action]} onSelectionChange={keys => setDeployForm(prev => ({ ...prev, action: Array.from(keys)[0] as string }))} variant="bordered">
                <SelectItem key="present">{t("安装/更新")}</SelectItem>
                <SelectItem key="restarted">{t("重启")}</SelectItem>
                <SelectItem key="status">{t("状态")}</SelectItem>
                <SelectItem key="absent">{t("卸载")}</SelectItem>
              </Select>
              <Input label={t("协议")} value={deployForm.protocol} onChange={e => setDeployForm(prev => ({ ...prev, protocol: e.target.value }))} variant="bordered" />
              <Input label={t("版本族")} value={deployForm.versionFamily} onChange={e => setDeployForm(prev => ({ ...prev, versionFamily: e.target.value }))} variant="bordered" />
              <Input label={t("固定版本")} value={deployForm.exactVersion} onChange={e => setDeployForm(prev => ({ ...prev, exactVersion: e.target.value }))} variant="bordered" />
              <Input label={t("监听端口")} type="number" value={deployForm.listenPort.toString()} onChange={e => setDeployForm(prev => ({ ...prev, listenPort: Number(e.target.value) || 0 }))} variant="bordered" />
              <div className="space-y-2">
                <Input label="Snell PSK" value={deployForm.psk} onChange={e => setDeployForm(prev => ({ ...prev, psk: e.target.value }))} variant="bordered" />
                <Button size="sm" variant="flat" onPress={() => setDeployForm(prev => ({ ...prev, psk: randomToken(32) }))}>{t("生成 PSK")}</Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeployModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveDeployTask}>{t("生成")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={orchestrationModalOpen} onOpenChange={setOrchestrationModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("一键编排 Xray / Snell")}</ModalHeader>
          <ModalBody>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label={t("目标服务器")}
                  selectionMode="multiple"
                  selectedKeys={orchestrationForm.serverIds.map(id => id.toString())}
                  onSelectionChange={keys => {
                    const serverIds = Array.from(keys).map(key => Number(key)).filter(Boolean);
                    const serverId = serverIds[0] || null;
                    const server = servers.find(item => item.id === serverId);
                    patchOrchestrationForm({
                      serverId,
                      serverIds,
                      publicHost: server?.host || orchestrationForm.publicHost,
                      certificateDomain: server?.host?.includes(".") ? server.host : orchestrationForm.certificateDomain,
                      webBasePath: serverId ? `ob-${serverId}` : orchestrationForm.webBasePath
                    });
                  }}
                  variant="bordered"
                >
                  {renderServerOptions()}
                </Select>
                <Input label={t("公网主机")} value={orchestrationForm.publicHost} onChange={e => patchOrchestrationForm({ publicHost: e.target.value })} variant="bordered" />
                <Input label={t("面板版本")} value={orchestrationForm.xuiVersion} onChange={e => patchOrchestrationForm({ xuiVersion: e.target.value })} variant="bordered" placeholder={t("留空使用最新版")} />
              </div>
              {selectedOrchestrationHasMaster && (
                <MasterRiskNotice context="生成一键编排任务" />
              )}
              {selectedOrchestrationLowMemoryServers.length > 0 && (
                <div className={`rounded-small border px-3 py-2 text-xs leading-5 ${
                  selectedOrchestrationCriticalNanoServers.length > 0
                    ? "border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300"
                    : "border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
                }`}>
                  <span className="font-semibold">{t("Nano 被控风险：")}</span>
                  {t("已选择 {count} 台低内存服务器。低于 200MB 时主控会阻止完整 Xray 编排；建议只保留 Snell 或端口转发，并先开启 swap。", {
                    count: selectedOrchestrationLowMemoryServers.length
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-small border border-default-200 p-4">
                <Switch isSelected={orchestrationForm.installXui} onValueChange={value => patchOrchestrationForm({ installXui: value })}>{t("安装面板运行时")}</Switch>
                <Switch isSelected={orchestrationForm.configurePanel} onValueChange={value => patchOrchestrationForm({ configurePanel: value })}>{t("配置面板")}</Switch>
                <Switch isSelected={orchestrationForm.installSnell} onValueChange={value => patchOrchestrationForm({ installSnell: value })}>{t("安装 Snell")}</Switch>
                <Switch isSelected={orchestrationForm.createVlessReality || orchestrationForm.createVmessWs || orchestrationForm.createTrojanTls || orchestrationForm.createShadowsocks} isReadOnly>{t("创建节点")}</Switch>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label={t("面板端口")} type="number" value={orchestrationForm.panelPort.toString()} onChange={e => patchOrchestrationForm({ panelPort: Number(e.target.value) || 5168 })} variant="bordered" />
                <Input label={t("面板用户名")} value={orchestrationForm.panelUsername} onChange={e => patchOrchestrationForm({ panelUsername: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                <Input label={t("面板密码")} type="password" value={orchestrationForm.panelPassword} onChange={e => patchOrchestrationForm({ panelPassword: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                <Input label="Web Base Path" value={orchestrationForm.webBasePath} onChange={e => patchOrchestrationForm({ webBasePath: e.target.value })} variant="bordered" />
                <Input label={t("监听 IP")} value={orchestrationForm.listenIp} onChange={e => patchOrchestrationForm({ listenIp: e.target.value })} variant="bordered" />
                <Select label={t("证书模式")} selectedKeys={[orchestrationForm.certificateMode]} onSelectionChange={keys => patchOrchestrationForm({ certificateMode: Array.from(keys)[0] as OrchestrationForm["certificateMode"] })} variant="bordered">
                  <SelectItem key="self-signed">{t("自签名")}</SelectItem>
                  <SelectItem key="acme-http">ACME HTTP</SelectItem>
                  <SelectItem key="none">{t("不配置")}</SelectItem>
                </Select>
                <Input label={t("证书域名")} value={orchestrationForm.certificateDomain} onChange={e => patchOrchestrationForm({ certificateDomain: e.target.value })} variant="bordered" />
                <Input label={t("ACME 邮箱")} value={orchestrationForm.acmeEmail} onChange={e => patchOrchestrationForm({ acmeEmail: e.target.value })} variant="bordered" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 rounded-small border border-default-200 p-4">
                <div className="space-y-3">
                  <Switch isSelected={orchestrationForm.createVlessReality} onValueChange={value => patchOrchestrationForm({ createVlessReality: value })}>VLESS Reality</Switch>
                  <Input label={t("VLESS 端口")} type="number" value={orchestrationForm.vlessPort.toString()} onChange={e => patchOrchestrationForm({ vlessPort: Number(e.target.value) || 443 })} variant="bordered" />
                  <Input label="Reality SNI" value={orchestrationForm.realitySni} onChange={e => patchOrchestrationForm({ realitySni: e.target.value })} variant="bordered" />
                  <Input label="Reality Dest" value={orchestrationForm.realityDest} onChange={e => patchOrchestrationForm({ realityDest: e.target.value })} variant="bordered" />
                </div>
                <div className="space-y-3">
                  <Switch isSelected={orchestrationForm.createVmessWs} onValueChange={value => patchOrchestrationForm({ createVmessWs: value })}>VMess WS</Switch>
                  <Input label={t("VMess 端口")} type="number" value={orchestrationForm.vmessPort.toString()} onChange={e => patchOrchestrationForm({ vmessPort: Number(e.target.value) || 2086 })} variant="bordered" />
                  <Input label="WS Path" value={orchestrationForm.wsPath} onChange={e => patchOrchestrationForm({ wsPath: e.target.value })} variant="bordered" />
                </div>
                <div className="space-y-3">
                  <Switch isSelected={orchestrationForm.createTrojanTls} onValueChange={value => patchOrchestrationForm({ createTrojanTls: value })}>Trojan TLS</Switch>
                  <Input label={t("Trojan 端口")} type="number" value={orchestrationForm.trojanPort.toString()} onChange={e => patchOrchestrationForm({ trojanPort: Number(e.target.value) || 8443 })} variant="bordered" />
                </div>
                <div className="space-y-3">
                  <Switch isSelected={orchestrationForm.createShadowsocks} onValueChange={value => patchOrchestrationForm({ createShadowsocks: value })}>Shadowsocks</Switch>
                  <Input label={t("SS 端口")} type="number" value={orchestrationForm.shadowsocksPort.toString()} onChange={e => patchOrchestrationForm({ shadowsocksPort: Number(e.target.value) || 8388 })} variant="bordered" />
                  <Input label={t("SS 加密")} value={orchestrationForm.ssMethod} onChange={e => patchOrchestrationForm({ ssMethod: e.target.value })} variant="bordered" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t("Snell 端口")} type="number" value={orchestrationForm.snellPort.toString()} onChange={e => patchOrchestrationForm({ snellPort: Number(e.target.value) || 8390 })} variant="bordered" />
                <div className="space-y-2">
                  <Input label="Snell PSK" value={orchestrationForm.snellPsk} onChange={e => patchOrchestrationForm({ snellPsk: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                  <Button size="sm" variant="flat" onPress={() => patchOrchestrationForm({ snellPsk: randomToken(32) })}>{t("生成 PSK")}</Button>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setOrchestrationModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveOrchestrationTask}>{t("生成一键任务")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={threeXuiInboundModalOpen} onOpenChange={setThreeXuiInboundModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("入站操作")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label={t("动作")} selectedKeys={[threeXuiInboundForm.mode]} onSelectionChange={keys => patchThreeXuiInboundForm({ mode: Array.from(keys)[0] as ThreeXuiInboundForm["mode"] })} variant="bordered">
                <SelectItem key="add">{t("新增 inbound")}</SelectItem>
                <SelectItem key="update">{t("更新 inbound")}</SelectItem>
                <SelectItem key="delete">{t("删除 inbound")}</SelectItem>
              </Select>
              <Select label={t("编辑方式")} selectedKeys={[threeXuiInboundForm.editMode]} onSelectionChange={keys => patchThreeXuiInboundForm({ editMode: Array.from(keys)[0] as ThreeXuiInboundForm["editMode"] })} variant="bordered">
                <SelectItem key="form">{t("结构化表单")}</SelectItem>
                <SelectItem key="json">{t("高级 JSON")}</SelectItem>
              </Select>
              <Input label={t("服务器 ID")} value={threeXuiInboundForm.serverId?.toString() || ""} isReadOnly variant="bordered" />
              <Input label="Inbound ID" value={threeXuiInboundForm.inboundId} onChange={e => patchThreeXuiInboundForm({ inboundId: e.target.value })} variant="bordered" />
              <Input label={t("备注")} value={threeXuiInboundForm.remark} onChange={e => patchThreeXuiInboundForm({ remark: e.target.value })} variant="bordered" />
              <Select label={t("启用")} selectedKeys={[threeXuiInboundForm.enable.toString()]} onSelectionChange={keys => patchThreeXuiInboundForm({ enable: Number(Array.from(keys)[0]) })} variant="bordered">
                <SelectItem key="1">{t("启用")}</SelectItem>
                <SelectItem key="0">{t("停用")}</SelectItem>
              </Select>
              <Input label={t("监听地址")} value={threeXuiInboundForm.listen} onChange={e => patchThreeXuiInboundForm({ listen: e.target.value })} variant="bordered" placeholder={t("留空监听所有地址")} />
              <Input label={t("端口")} type="number" value={threeXuiInboundForm.port.toString()} onChange={e => patchThreeXuiInboundForm({ port: Number(e.target.value) || 0 })} variant="bordered" />
              <Select label={t("协议")} selectedKeys={[threeXuiInboundForm.protocol]} onSelectionChange={keys => updateInboundProtocol(Array.from(keys)[0] as ThreeXuiInboundForm["protocol"])} variant="bordered">
                <SelectItem key="vless">VLESS</SelectItem>
                <SelectItem key="vmess">VMess</SelectItem>
                <SelectItem key="trojan">Trojan</SelectItem>
                <SelectItem key="shadowsocks">Shadowsocks</SelectItem>
              </Select>
              <Select label={t("传输")} selectedKeys={[threeXuiInboundForm.network]} onSelectionChange={keys => patchThreeXuiInboundForm({ network: Array.from(keys)[0] as ThreeXuiInboundForm["network"] })} variant="bordered">
                <SelectItem key="tcp">TCP</SelectItem>
                <SelectItem key="ws">WebSocket</SelectItem>
              </Select>
              <Select label={t("安全")} selectedKeys={[threeXuiInboundForm.security]} onSelectionChange={keys => patchThreeXuiInboundForm({ security: Array.from(keys)[0] as ThreeXuiInboundForm["security"] })} variant="bordered">
                <SelectItem key="none">None</SelectItem>
                <SelectItem key="tls">TLS</SelectItem>
                <SelectItem key="reality">Reality</SelectItem>
              </Select>
            </div>
            {selectedInboundServer?.role === "master" && (
              <MasterRiskNotice context="提交入站操作" />
            )}

            {threeXuiInboundForm.mode !== "delete" && threeXuiInboundForm.editMode === "form" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label={t("客户端 Email")} value={threeXuiInboundForm.clientEmail} onChange={e => patchThreeXuiInboundForm({ clientEmail: e.target.value })} variant="bordered" />
                  {threeXuiInboundForm.protocol !== "trojan" && threeXuiInboundForm.protocol !== "shadowsocks" && (
                    <div className="space-y-2">
                      <Input label={t("客户端 UUID")} value={threeXuiInboundForm.clientId} onChange={e => patchThreeXuiInboundForm({ clientId: e.target.value })} variant="bordered" />
                      <Button size="sm" variant="flat" onPress={() => patchThreeXuiInboundForm({ clientId: randomUuid() })}>{t("生成 UUID")}</Button>
                    </div>
                  )}
                  {(threeXuiInboundForm.protocol === "trojan" || threeXuiInboundForm.protocol === "shadowsocks") && (
                    <Input label={t("客户端密码 / PSK")} value={threeXuiInboundForm.clientPassword} onChange={e => patchThreeXuiInboundForm({ clientPassword: e.target.value })} variant="bordered" />
                  )}
                  {threeXuiInboundForm.protocol === "vless" && (
                    <Input label="Flow" value={threeXuiInboundForm.flow} onChange={e => patchThreeXuiInboundForm({ flow: e.target.value })} variant="bordered" />
                  )}
                  <Input label={t("流量限制 GB")} type="number" value={threeXuiInboundForm.totalGb.toString()} onChange={e => patchThreeXuiInboundForm({ totalGb: Number(e.target.value) || 0 })} variant="bordered" />
                  <Input label={t("有效期天数")} type="number" value={threeXuiInboundForm.expiryDays.toString()} onChange={e => patchThreeXuiInboundForm({ expiryDays: Number(e.target.value) || 0 })} variant="bordered" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="SNI / Host" value={threeXuiInboundForm.sni} onChange={e => patchThreeXuiInboundForm({ sni: e.target.value })} variant="bordered" />
                  {threeXuiInboundForm.protocol === "vless" && threeXuiInboundForm.security === "reality" && (
                    <>
                        <Input label="Reality Dest" value={threeXuiInboundForm.realityDest} onChange={e => patchThreeXuiInboundForm({ realityDest: e.target.value })} variant="bordered" />
                        <div className="space-y-2">
                          <Input label="Reality Private Key" value={threeXuiInboundForm.realityPrivateKey} onChange={e => patchThreeXuiInboundForm({ realityPrivateKey: e.target.value })} variant="bordered" />
                        <Button size="sm" variant="flat" onPress={() => patchThreeXuiInboundForm({ realityPrivateKey: randomRealityPrivateKey() })}>{t("生成私钥")}</Button>
                      </div>
                      <div className="space-y-2">
                        <Input label="Reality Short ID" value={threeXuiInboundForm.realityShortId} onChange={e => patchThreeXuiInboundForm({ realityShortId: e.target.value })} variant="bordered" />
                        <Button size="sm" variant="flat" onPress={() => patchThreeXuiInboundForm({ realityShortId: randomHex(8) })}>{t("生成 Short ID")}</Button>
                      </div>
                    </>
                  )}
                  {threeXuiInboundForm.protocol === "vmess" && (
                    <Input label="WebSocket Path" value={threeXuiInboundForm.wsPath} onChange={e => patchThreeXuiInboundForm({ wsPath: e.target.value })} variant="bordered" />
                  )}
                  {threeXuiInboundForm.protocol === "shadowsocks" && (
                    <Input label={t("加密方法")} value={threeXuiInboundForm.ssMethod} onChange={e => patchThreeXuiInboundForm({ ssMethod: e.target.value })} variant="bordered" />
                  )}
                </div>
              </div>
            )}

            {threeXuiInboundForm.mode !== "delete" && (
              <Textarea
                label={threeXuiInboundForm.editMode === "json" ? "Inbound Payload JSON" : t("生成的 Payload 预览")}
                minRows={14}
                value={threeXuiInboundForm.editMode === "json" ? threeXuiInboundForm.payloadJson : inboundPayloadPreview(threeXuiInboundForm)}
                onChange={e => patchThreeXuiInboundForm({ payloadJson: e.target.value })}
                readOnly={threeXuiInboundForm.editMode === "form"}
                variant="bordered"
                classNames={{ input: "font-mono text-xs" }}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setThreeXuiInboundModalOpen(false)}>{t("取消")}</Button>
            <Button color={threeXuiInboundForm.mode === "delete" ? "danger" : "primary"} isLoading={submitting} onPress={() => saveThreeXuiInbound()}>{t("提交")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={xraySettingModalOpen} onOpenChange={setXraySettingModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("保存 Xray 路由 / 出站配置")}</ModalHeader>
          <ModalBody>
            <Input label={t("Outbound 测试地址")} value={outboundTestUrl} onChange={e => setOutboundTestUrl(e.target.value)} variant="bordered" />
            <div className="rounded-small border border-default-200 bg-default-50/60 p-3 text-xs leading-5 text-gray-600 dark:bg-default-50/5 dark:text-gray-300">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Chip size="sm" variant="flat" color="primary">{t("出站")}</Chip>
                <Chip size="sm" variant="flat" color="primary">{t("路由规则")}</Chip>
                <Chip size="sm" variant="flat" color="primary">IPv4 / IPv6</Chip>
                <Chip size="sm" variant="flat" color="primary">{t("规则优先")}</Chip>
              </div>
              {t("这里保存完整 Xray 配置，包含 outbounds、routing.rules、domainStrategy、DNS 和 IPv4/IPv6 相关策略；规则匹配顺序以 JSON 中的数组顺序为准。")}
            </div>
            <Textarea
              label={t("完整 Xray 配置 JSON")}
              minRows={22}
              value={xraySettingText}
              onChange={e => setXraySettingText(e.target.value)}
              variant="bordered"
              classNames={{ input: "font-mono text-xs" }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setXraySettingModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={() => saveXraySetting()}>{t("保存配置")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(pendingAgentMaintenance)} onOpenChange={open => !open && setPendingAgentMaintenance(null)} size="lg">
        <ModalContent data-testid="danger-action-confirm">
          <ModalHeader>{t("确认危险操作")}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("该操作会通过被控 Agent 在远端服务器执行，请确认目标和动作无误。")}
              </p>
              <div className="rounded-small border border-danger-200 bg-danger-50 p-3 text-sm dark:border-danger-500/30 dark:bg-danger-500/10">
                <p className="font-semibold text-danger">{pendingAgentMaintenance?.actionText}</p>
                <p className="mt-1 text-gray-600 dark:text-gray-300">{pendingAgentMaintenance?.server.name}</p>
                <p className="text-xs text-gray-500">{pendingAgentMaintenance?.server.host}:{pendingAgentMaintenance?.server.sshPort || 22}</p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setPendingAgentMaintenance(null)}>{t("取消")}</Button>
            <Button color="danger" isLoading={submitting} onPress={confirmPendingAgentMaintenance}>{t("确认执行")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(pendingUiConfirmation)} onOpenChange={open => !open && setPendingUiConfirmation(null)} size="lg">
        <ModalContent data-testid={pendingUiConfirmation?.testId || "ui-action-confirm"}>
          <ModalHeader>{pendingUiConfirmation?.title || t("确认操作")}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{pendingUiConfirmation?.message}</p>
              {pendingUiConfirmation?.detail && (
                <div className="rounded-small border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
                  {pendingUiConfirmation.detail}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setPendingUiConfirmation(null)}>{t("取消")}</Button>
            <Button color={(pendingUiConfirmation?.color || "danger") as any} isLoading={submitting} onPress={confirmPendingUiAction}>
              {pendingUiConfirmation?.confirmText || t("确认")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={scriptModalOpen} onOpenChange={setScriptModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{scriptTitle}</ModalHeader>
          <ModalBody>
            <Textarea value={scriptText} minRows={18} readOnly variant="bordered" classNames={{ input: "font-mono text-xs" }} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setScriptModalOpen(false)}>{t("关闭")}</Button>
            <Button color="primary" onPress={copyScript}>{t("复制")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
