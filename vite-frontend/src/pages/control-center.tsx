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
  createDeploymentPlanTask,
  createProtocolProfile,
  createServerForwardRule,
  deleteControlServer,
  deleteDeployTask,
  deleteProtocolNode,
  deleteProtocolProfile,
  deleteServerForwardRule,
  addXrayRuntimeInbound,
  deleteXrayRuntimeInbound,
  ensureDefaultProtocolProfiles,
  getControlServerList,
  getControlServerInstallCommand,
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
  getXrayRuntimeConfig,
  getXrayRuntimeOutboundTraffic,
  getXrayRuntimeOutbounds,
  listXrayRuntimeTraffic,
  listXrayRuntimeInbounds,
  rotateControlServerToken,
  restartProtocolNode,
  restartServerForwardRule,
  restartXrayRuntimeXray,
  retryDeployTask,
  saveXrayRuntimeOutbounds,
  syncXrayRuntimeTraffic,
  syncProtocolNodes,
  testXrayRuntimeConnection,
  updateXrayRuntimeInbound,
  updateControlServer,
  updateProtocolNode,
  updateProtocolProfile,
  updateServerForwardRule
} from "@/api";
import type { ControlServer, DeployTask, MonitorAlert, OperationAuditLog, ProtocolNode, ProtocolProfile, RuntimeProviderAction, RuntimeProviderDescriptor, RuntimeState, RuntimeStateOverview, RuntimeStateOverviewItem, ServerForwardRule, XrayRuntimeTrafficSnapshot } from "@/types";

interface ServerForm {
  id?: number;
  name: string;
  role: string;
  endpoint: string;
  xrayRuntimeEndpoint: string;
  xrayRuntimeBasePath: string;
  xrayRuntimeApiToken: string;
  xrayRuntimeUsername: string;
  xrayRuntimePassword: string;
  xrayRuntimeTwoFactorCode: string;
  xrayRuntimeAllowInsecure: number;
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

interface DeploymentPlanForm {
  serverId: number | null;
  serverIds: number[];
  installXrayRuntime: boolean;
  configureRuntime: boolean;
  xrayRuntimeVersion: string;
  runtimePort: number;
  runtimeUsername: string;
  runtimePassword: string;
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

interface XrayRuntimeInboundForm {
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

type RuleKindFilter = "all" | "protocol" | "forward" | "xrayRuntime";
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
  fallbackAction("doctor", "诊断", "diagnostic", "xrayRuntime", false, true, false),
  fallbackAction("status", "状态", "diagnostic", "xrayRuntime", false, false, false),
  fallbackAction("logs", "日志", "diagnostic", "xrayRuntime", false, true, false),
  fallbackAction("install-diagnose", "安装诊断", "diagnostic", "xrayRuntime", false, true, true),
  fallbackAction("cert-diagnose", "证书诊断", "diagnostic", "certificate", false, true, true),
  fallbackAction("firewall-diagnose", "防火墙诊断", "diagnostic", "firewall", false, true, true),
  fallbackAction("firewall-diagnose", "防火墙诊断", "diagnostic", "forward", false, true, true),
  fallbackAction("repair-all", "一键修复", "repair", "xrayRuntime", false, true, false),
  fallbackAction("repair-xray-runtime", "修复 Xray Runtime", "repair", "xrayRuntime", false, true, true),
  fallbackAction("repair-xray", "修复 Xray", "repair", "xrayRuntime", false, true, true),
  fallbackAction("repair-snell", "修复 Snell", "repair", "snell", false, true, true),
  fallbackAction("restart-agent", "重启 agent", "maintenance", "xrayRuntime"),
  fallbackAction("upgrade-agent", "升级 agent", "maintenance", "xrayRuntime"),
  fallbackAction("uninstall-agent", "卸载 agent", "danger", "xrayRuntime", true, false, false)
];

const AGENT_ACTION_ORDER = [
  "doctor",
  "logs",
  "install-diagnose",
  "cert-diagnose",
  "firewall-diagnose",
  "repair-all",
  "repair-xray-runtime",
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
    if (!byKey.has(action.key) || action.providerKey !== "xrayRuntime") {
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
  if (providerKey === "xrayRuntime") {
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
  if (item?.providerKey === "xrayRuntime") {
    return runtimeProviderStatusNeedsRepair(item.serviceStatuses?.xray)
      ? findProviderAction(actions, item.providerKey, "repair-xray") || null
      : findProviderAction(actions, item.providerKey, "repair-xray-runtime") || null;
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
  snapshot?: XrayRuntimeTrafficSnapshot;
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
  xrayRuntimeEndpoint: "",
  xrayRuntimeBasePath: "",
  xrayRuntimeApiToken: "",
  xrayRuntimeUsername: "",
  xrayRuntimePassword: "",
  xrayRuntimeTwoFactorCode: "",
  xrayRuntimeAllowInsecure: 0,
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

const blankDeploymentPlanForm: DeploymentPlanForm = {
  serverId: null,
  serverIds: [],
  installXrayRuntime: true,
  configureRuntime: true,
  xrayRuntimeVersion: "",
  runtimePort: 5168,
  runtimeUsername: "",
  runtimePassword: "",
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

const blankXrayRuntimeInboundForm: XrayRuntimeInboundForm = {
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

const withGeneratedProtocolNodeSecrets = (form: ProtocolNodeForm): ProtocolNodeForm => {
  const next = { ...form };
  if ((next.protocol === "vless" || next.protocol === "vmess") && isPlaceholderValue(next.clientId)) {
    next.clientId = randomUuid();
  }
  if ((next.protocol === "trojan" || next.protocol === "shadowsocks") && isPlaceholderValue(next.clientPassword)) {
    next.clientPassword = randomToken(24);
  }
  if (next.protocol === "vless" && next.security === "reality") {
    if (isPlaceholderValue(next.realityPrivateKey)) {
      next.realityPrivateKey = randomRealityPrivateKey();
    }
    if (!next.realityShortId.trim()) {
      next.realityShortId = randomHex(8);
    }
  }
  if (next.protocol === "snell" && isPlaceholderValue(next.snellPsk)) {
    next.snellPsk = randomToken(32);
  }
  return next;
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

const deploymentPlanUsesFullXrayRuntimeStack = (form: DeploymentPlanForm) => {
  return form.installXrayRuntime
    || form.configureRuntime
    || form.createVlessReality
    || form.createVmessWs
    || form.createTrojanTls
    || form.createShadowsocks;
};

const MasterRiskNotice = ({ context }: { context: string }) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-small border border-warning-300 bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
      <span className="font-semibold">{t("主控高风险：")}</span>{t("{context}会作用在控制面服务器上，建议确认 API、Xray 运行时以及证书任务不会影响现有部署。", { context: t(context) })}
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
  if (key === "xrayRuntime") return "primary";
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

const RuntimeStateBlock = ({ task }: { task: DeployTask }) => {
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

const DiagnosticSummaryBlock = ({ task, onShowResult }: { task: DeployTask; onShowResult: (task: DeployTask) => void }) => {
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

const RemoteLogsBlock = ({ task, onShowResult }: { task: DeployTask; onShowResult: (task: DeployTask) => void }) => {
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

const AgentUpgradeBlock = ({ task, onShowResult }: { task: DeployTask; onShowResult: (task: DeployTask) => void }) => {
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

const clientBase = (form: XrayRuntimeInboundForm) => ({
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

const buildInboundPayloadFromForm = (form: XrayRuntimeInboundForm) => {
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

const inboundPayloadPreview = (form: XrayRuntimeInboundForm) => JSON.stringify(buildInboundPayloadFromForm(form), null, 2);

const inboundFormFromNodeForm = (form: ProtocolNodeForm): XrayRuntimeInboundForm => ({
  ...blankXrayRuntimeInboundForm,
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

export default function ControlCenterPage() {
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
  const [trafficSnapshots, setTrafficSnapshots] = useState<XrayRuntimeTrafficSnapshot[]>([]);
  const [monitorAlerts, setMonitorAlerts] = useState<MonitorAlert[]>([]);
  const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([]);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [protocolNodeModalOpen, setProtocolNodeModalOpen] = useState(false);
  const [serverForwardModalOpen, setServerForwardModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deploymentPlanModalOpen, setDeploymentPlanModalOpen] = useState(false);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [xrayRuntimeInboundModalOpen, setXrayRuntimeInboundModalOpen] = useState(false);
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
  const [deploymentPlanForm, setDeploymentPlanForm] = useState<DeploymentPlanForm>(blankDeploymentPlanForm);
  const [xrayRuntimeInboundForm, setXrayRuntimeInboundForm] = useState<XrayRuntimeInboundForm>(blankXrayRuntimeInboundForm);
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

  const selectedDeploymentPlanServers = useMemo(() => {
    return servers.filter(server => deploymentPlanForm.serverIds.includes(server.id));
  }, [deploymentPlanForm.serverIds, servers]);

  const selectedDeploymentPlanHasMaster = selectedDeploymentPlanServers.some(server => server.role === "master");
  const selectedDeploymentPlanLowMemoryServers = selectedDeploymentPlanServers.filter(isLowMemoryServer);
  const selectedDeploymentPlanCriticalNanoServers = selectedDeploymentPlanServers.filter(isNanoCriticalServer);
  const selectedDeploymentPlanUsesFullXrayRuntimeStack = deploymentPlanUsesFullXrayRuntimeStack(deploymentPlanForm);

  const selectedInboundServer = useMemo(() => {
    return servers.find(server => server.id === xrayRuntimeInboundForm.serverId);
  }, [servers, xrayRuntimeInboundForm.serverId]);

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

    const xrayRuntimeRows = trafficSnapshots.map(snapshot => ({
      id: `xrayRuntime-${snapshot.id}`,
      kind: "xrayRuntime" as const,
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

    return [...nodeRows, ...forwardRows, ...xrayRuntimeRows];
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
      xrayRuntimeEndpoint: server.xrayRuntimeEndpoint || "",
      xrayRuntimeBasePath: server.xrayRuntimeBasePath || "",
      xrayRuntimeApiToken: server.xrayRuntimeApiToken || "",
      xrayRuntimeUsername: server.xrayRuntimeUsername || "",
      xrayRuntimePassword: server.xrayRuntimePassword || "",
      xrayRuntimeTwoFactorCode: server.xrayRuntimeTwoFactorCode || "",
      xrayRuntimeAllowInsecure: server.xrayRuntimeAllowInsecure || 0,
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
    setProtocolNodeForm(withGeneratedProtocolNodeSecrets({
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
    }));
    setProtocolNodePreviewOpen(false);
    setProtocolNodeModalOpen(true);
  };

  const patchProtocolNodeForm = (patch: Partial<ProtocolNodeForm>) => {
    setProtocolNodeForm(prev => ({ ...prev, ...patch }));
  };

  const updateProtocolNodeProtocol = (protocol: ProtocolNodeForm["protocol"]) => {
    const defaults: Record<ProtocolNodeForm["protocol"], Partial<ProtocolNodeForm>> = {
      vless: { protocol, engine: "xray", name: "ob-vless", port: 443, transport: "tcp", security: "reality", flow: "xtls-rprx-vision", clientId: randomUuid(), realityPrivateKey: randomRealityPrivateKey(), realityShortId: randomHex(8) },
      vmess: { protocol, engine: "xray", name: "ob-vmess", port: 2086, transport: "ws", security: "none", flow: "", clientId: randomUuid() },
      trojan: { protocol, engine: "xray", name: "ob-trojan", port: 8443, transport: "tcp", security: "tls", flow: "", clientPassword: randomToken(24) },
      shadowsocks: { protocol, engine: "xray", name: "ob-shadowsocks", port: 8388, transport: "tcp", security: "none", flow: "", clientPassword: randomToken(24) },
      snell: { protocol, engine: "snell", name: "ob-snell", listen: "::0", port: 8390, transport: "tcp", security: "psk", flow: "", snellPsk: randomToken(32) }
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

  const openDeploymentPlanModal = (server?: ControlServer) => {
    const firstServer = server || servers[0];
    const host = firstServer?.host || "";
    setDeploymentPlanForm({
      ...blankDeploymentPlanForm,
      serverId: firstServer?.id || null,
      serverIds: firstServer?.id ? [firstServer.id] : [],
      publicHost: host,
      certificateDomain: host.includes(".") ? host : "",
      webBasePath: firstServer?.id ? `ob-${firstServer.id}` : "ob-control"
    });
    setDeploymentPlanModalOpen(true);
  };

  const patchDeploymentPlanForm = (patch: Partial<DeploymentPlanForm>) => {
    setDeploymentPlanForm(prev => ({ ...prev, ...patch }));
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
      if (!serverForm.id && res.data?.id) {
        await showServerInstallCommand(res.data);
      }
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
    const form = withGeneratedProtocolNodeSecrets(protocolNodeForm);
    setProtocolNodeForm(form);
    if (!form.serverId) {
      toast.error(t("请选择目标服务器"));
      return;
    }
    if (!form.name.trim()) {
      toast.error(t("请填写节点名称"));
      return;
    }
    if (!form.port || form.port < 1 || form.port > 65535) {
      toast.error(t("节点端口不合法"));
      return;
    }
    if (form.protocol !== "snell" && isNanoCriticalServer(selectedProtocolServer)) {
      toast.error(t("Nano 被控低于 200MB，不支持创建 Xray 入站节点；请改用 Snell 或远端端口转发。"));
      return;
    }

    const isSnell = form.protocol === "snell";
    const payload = isSnell ? undefined : withOutboundTag(
      buildInboundPayloadFromForm(inboundFormFromNodeForm(form)),
      form.outboundTag
    );
    const requestPayload = isSnell ? {
      id: form.id,
      serverId: form.serverId,
      name: form.name,
      protocol: "snell",
      engine: "snell",
      direction: "inbound",
      listen: form.listen || "::0",
      port: form.port,
      transport: "tcp",
      security: "psk",
      credentialJson: JSON.stringify({ psk: form.snellPsk }),
      configJson: JSON.stringify({ version: form.snellVersion || "v4.1.1" })
    } : {
      id: form.id,
      serverId: form.serverId,
      name: form.name,
      protocol: form.protocol,
      engine: "xray",
      direction: "inbound",
      listen: form.listen,
      port: form.port,
      transport: form.transport,
      security: form.security,
      configJson: JSON.stringify(payload),
      payload
    };

    setSubmitting(true);
    const res = form.id ? await updateProtocolNode(requestPayload) : await createProtocolNode(requestPayload);
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
      showXrayRuntimeResult(t("{name} 出入站与转发规则", { name: server.name }), res.data);
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
        source: "control-center-ui",
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

  const saveDeploymentPlanTask = async () => {
    const targetServerIds = deploymentPlanForm.serverIds.length > 0
      ? deploymentPlanForm.serverIds
      : deploymentPlanForm.serverId ? [deploymentPlanForm.serverId] : [];
    if (targetServerIds.length === 0) {
      toast.error(t("请选择目标服务器"));
      return;
    }
    if (deploymentPlanForm.certificateMode === "acme-http" && !deploymentPlanForm.certificateDomain.trim()) {
      toast.error(t("ACME 证书模式需要填写域名"));
      return;
    }
    if (selectedDeploymentPlanCriticalNanoServers.length > 0 && selectedDeploymentPlanUsesFullXrayRuntimeStack) {
      toast.error(t("Nano 被控内存低于 200MB，不支持完整 Xray 部署；请关闭 Xray 相关选项，仅保留 Snell 或端口转发。"));
      return;
    }
    const ports = [
      ["Xray Runtime", deploymentPlanForm.runtimePort, true],
      ["VLESS Reality", deploymentPlanForm.vlessPort, deploymentPlanForm.createVlessReality],
      ["VMess WS", deploymentPlanForm.vmessPort, deploymentPlanForm.createVmessWs],
      ["Trojan TLS", deploymentPlanForm.trojanPort, deploymentPlanForm.createTrojanTls],
      ["Shadowsocks", deploymentPlanForm.shadowsocksPort, deploymentPlanForm.createShadowsocks],
      ["Snell", deploymentPlanForm.snellPort, deploymentPlanForm.installSnell]
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
      const payload = { ...deploymentPlanForm } as any;
      delete payload.serverIds;
      const targetServer = servers.find(server => server.id === serverId);
      results.push(await createDeploymentPlanTask({
        ...payload,
        serverId,
        publicHost: targetServer?.host || deploymentPlanForm.publicHost,
        certificateDomain: deploymentPlanForm.certificateDomain || (targetServer?.host?.includes(".") ? targetServer.host : "")
      }));
    }
    setSubmitting(false);

    const failed = results.find(res => res.code !== 0);
    if (!failed) {
      toast.success(t("已生成 {count} 个一键部署任务，等待副控 agent 自动领取", { count: results.length }));
      setDeploymentPlanModalOpen(false);
      setScriptTitle(t("一键部署任务"));
      setScriptText(results.map(res => `# Task ${res.data.id} / ${res.data.serverName || res.data.serverId}\n${res.data.script || ""}`).join("\n\n"));
      setScriptModalOpen(true);
      loadData();
    } else {
      toast.error(failed.msg || t("生成一键部署任务失败"));
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

  const showServerInstallCommand = async (server: ControlServer) => {
    const res = await getControlServerInstallCommand(server.id);
    if (res.code === 0) {
      setScriptTitle(t("{name} 被控加入命令", { name: server.name }));
      setScriptText(res.data || "");
      setScriptModalOpen(true);
    } else {
      toast.error(res.msg || t("生成被控加入命令失败"));
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

  const isXrayRuntimeSuccess = (res: any) => res.code === 0 && (!res.data || res.data.success !== false);

  const showXrayRuntimeResult = (title: string, data: any) => {
    setScriptTitle(title);
    setScriptText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    setScriptModalOpen(true);
  };

  const testXrayRuntime = async (server: ControlServer) => {
    const res = await testXrayRuntimeConnection(server.id);
    if (isXrayRuntimeSuccess(res)) {
      toast.success(t("Runtime API 连接正常"));
      showXrayRuntimeResult(t("{name} 运行时状态", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("Runtime API 连接失败"));
    }
  };

  const showXrayRuntimeInbounds = async (server: ControlServer) => {
    const res = await listXrayRuntimeInbounds(server.id);
    if (isXrayRuntimeSuccess(res)) {
      showXrayRuntimeResult(t("{name} 入站列表", { name: server.name }), res.data);
      loadData();
    } else {
      toast.error(res.msg || res.data?.msg || t("读取入站失败"));
    }
  };

  const showXrayRuntimeConfig = async (server: ControlServer) => {
    const res = await getXrayRuntimeConfig(server.id);
    if (isXrayRuntimeSuccess(res)) {
      showXrayRuntimeResult(t("{name} Xray 配置", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取配置失败"));
    }
  };

  const showXrayRuntimeOutbounds = async (server: ControlServer) => {
    const res = await getXrayRuntimeOutbounds(server.id);
    if (isXrayRuntimeSuccess(res)) {
      rememberOutboundTags(res.data);
      showXrayRuntimeResult(t("{name} 出站配置", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取出站失败"));
    }
  };

  const showXrayRuntimeOutboundTraffic = async (server: ControlServer) => {
    const res = await getXrayRuntimeOutboundTraffic(server.id);
    if (isXrayRuntimeSuccess(res)) {
      showXrayRuntimeResult(t("{name} 出站流量", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取出站流量失败"));
    }
  };

  const syncRuntimeTraffic = async (server: ControlServer) => {
    const res = await syncXrayRuntimeTraffic(server.id);
    if (isXrayRuntimeSuccess(res)) {
      toast.success(t("远端流量已同步入库"));
      showXrayRuntimeResult(t("{name} 流量同步结果", { name: server.name }), res.data);
      loadData();
    } else {
      toast.error(res.msg || res.data?.msg || t("同步流量失败"));
    }
  };

  const showTrafficSnapshots = async (server: ControlServer) => {
    const res = await listXrayRuntimeTraffic({ serverId: server.id, limit: 120 });
    if (res.code === 0) {
      const snapshots = res.data || [];
      setTrafficSnapshots(snapshots);
      showXrayRuntimeResult(t("{name} 本地流量快照", { name: server.name }), snapshots);
    } else {
      toast.error(res.msg || t("读取本地流量快照失败"));
    }
  };

  const openXrayRuntimeInboundModal = (server: ControlServer) => {
    setXrayRuntimeInboundForm({
      ...blankXrayRuntimeInboundForm,
      serverId: server.id,
      payloadJson: inboundPayloadPreview({ ...blankXrayRuntimeInboundForm, serverId: server.id })
    });
    setXrayRuntimeInboundModalOpen(true);
  };

  const patchXrayRuntimeInboundForm = (patch: Partial<XrayRuntimeInboundForm>) => {
    setXrayRuntimeInboundForm(prev => {
      const next = { ...prev, ...patch };
      return {
        ...next,
        payloadJson: next.editMode === "form" ? inboundPayloadPreview(next) : next.payloadJson
      };
    });
  };

  const updateInboundProtocol = (protocol: XrayRuntimeInboundForm["protocol"]) => {
    const defaults: Record<XrayRuntimeInboundForm["protocol"], Partial<XrayRuntimeInboundForm>> = {
      vless: { protocol, remark: "ob-vless", port: 443, network: "tcp", security: "reality", flow: "xtls-rprx-vision" },
      vmess: { protocol, remark: "ob-vmess", port: 2086, network: "ws", security: "none", flow: "" },
      trojan: { protocol, remark: "ob-trojan", port: 443, network: "tcp", security: "tls", flow: "" },
      shadowsocks: { protocol, remark: "ob-shadowsocks", port: 8388, network: "tcp", security: "none", flow: "" }
    };
    patchXrayRuntimeInboundForm(defaults[protocol]);
  };

  const saveXrayRuntimeInbound = async (confirmed = false) => {
    if (!xrayRuntimeInboundForm.serverId) {
      toast.error(t("请选择服务器"));
      return;
    }
    if (xrayRuntimeInboundForm.mode !== "add" && !xrayRuntimeInboundForm.inboundId.trim()) {
      toast.error(t("更新或删除入站时必须填写 inbound id"));
      return;
    }
    if (xrayRuntimeInboundForm.mode === "delete" && !confirmed) {
      requestUiConfirmation({
        title: t("确认删除入站"),
        message: t("确定删除入站 #{id}?", { id: xrayRuntimeInboundForm.inboundId || "-" }),
        detail: t("该操作会直接修改远端 Xray 入站配置。"),
        confirmText: t("确认删除"),
        color: "danger",
        testId: "confirm-delete-xray-inbound",
        onConfirm: () => saveXrayRuntimeInbound(true)
      });
      return;
    }

    setSubmitting(true);
    let res: any;
    try {
      const inboundId = xrayRuntimeInboundForm.inboundId ? Number(xrayRuntimeInboundForm.inboundId) : undefined;
      if (xrayRuntimeInboundForm.mode === "delete") {
        res = await deleteXrayRuntimeInbound({ serverId: xrayRuntimeInboundForm.serverId, inboundId });
      } else {
        const payload = xrayRuntimeInboundForm.editMode === "json"
          ? JSON.parse(xrayRuntimeInboundForm.payloadJson)
          : buildInboundPayloadFromForm(xrayRuntimeInboundForm);
        res = xrayRuntimeInboundForm.mode === "add"
          ? await addXrayRuntimeInbound({ serverId: xrayRuntimeInboundForm.serverId, payload })
          : await updateXrayRuntimeInbound({ serverId: xrayRuntimeInboundForm.serverId, inboundId, payload });
      }
    } catch (error) {
      setSubmitting(false);
      toast.error(xrayRuntimeInboundForm.editMode === "json" ? t("入站 JSON 格式不正确") : t("入站表单内容不完整"));
      return;
    }
    setSubmitting(false);

    if (isXrayRuntimeSuccess(res)) {
      toast.success(t("入站操作已提交"));
      setXrayRuntimeInboundModalOpen(false);
      showXrayRuntimeResult(t("入站操作结果"), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("入站操作失败"));
    }
  };

  const openXraySettingModal = async (server: ControlServer) => {
    const res = await getXrayRuntimeConfig(server.id);
    if (!isXrayRuntimeSuccess(res)) {
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
    const res = await saveXrayRuntimeOutbounds({
      serverId: xraySettingServerId,
      xraySetting: xraySettingText,
      outboundTestUrl
    });
    setSubmitting(false);

    if (isXrayRuntimeSuccess(res)) {
      toast.success(t("出站配置已保存"));
      setXraySettingModalOpen(false);
      showXrayRuntimeResult(t("出站保存结果"), res.data);
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
    const res = await restartXrayRuntimeXray(server.id);
    if (isXrayRuntimeSuccess(res)) {
      toast.success(t("已请求重启 Xray"));
      showXrayRuntimeResult(t("{name} Xray 重启结果", { name: server.name }), res.data);
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

  void runtimeProviderActionColor;
  void runtimeProviderDiagnosticAction;
  void runtimeProviderRepairAction;
  void ServerActionGroup;
  void RuntimeStateBlock;
  void DiagnosticSummaryBlock;
  void RemoteLogsBlock;
  void AgentUpgradeBlock;
  void setRuleSearch;
  void setRuleKindFilter;
  void setRuleServerFilter;
  void setRuleHealthFilter;
  void runningTasks;
  void serverAgentActions;
  void runtimeProviderTaskCounts;
  void runtimeProviderActiveTasks;
  void recentRuntimeStateItems;
  void filteredRuleRows;
  void ruleHealthCounts;
  void ruleServerOptions;
  void showServerRuleOverview;
  void createAgentMaintenance;
  void showServerToken;
  void showTaskScript;
  void showTaskResult;
  void testXrayRuntime;
  void showXrayRuntimeInbounds;
  void showXrayRuntimeConfig;
  void syncRuntimeTraffic;
  void showTrafficSnapshots;
  void openXrayRuntimeInboundModal;
  void copyRuleData;
  void acknowledgeAlert;
  void retryTask;
  void certificateText;

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overlord Broil</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("服务器、节点、转发、流量和证书统一管理")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button color="primary" data-testid="open-deployment-plan" onPress={() => openDeploymentPlanModal()}>{t("一键部署")}</Button>
            <Button color="primary" variant="flat" data-testid="open-protocol-node" onPress={() => openProtocolNodeModal()}>{t("新增节点")}</Button>
            <Button variant="flat" data-testid="open-server-modal" onPress={() => openServerModal()}>{t("添加服务器")}</Button>
            <Button variant="light" onPress={loadData}>{t("刷新")}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {[
            ["dashboard", t("仪表盘")],
            ["servers", t("服务器")],
            ["inbounds", t("入站节点")],
            ["routes", t("出站与路由")],
            ["tunnels", t("转发/隧道")],
            ["traffic", t("流量")],
            ["certificates", t("证书")],
            ["settings", t("设置")]
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-small border border-default-200 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 shadow-sm transition hover:border-primary hover:text-primary dark:bg-default-50/5 dark:text-gray-200"
            >
              {label}
            </a>
          ))}
        </div>

        <section id="dashboard" data-testid="broil-dashboard">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card radius="sm" className="border border-default-200">
              <CardBody>
                <p className="text-sm text-gray-500">{t("在线服务器")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{onlineServers}/{servers.length}</p>
                <p className="mt-1 text-xs text-gray-500">{criticalAlerts > 0 ? t("{count} 条异常待处理", { count: criticalAlerts }) : t("当前无严重告警")}</p>
              </CardBody>
            </Card>
            <Card radius="sm" className="border border-default-200">
              <CardBody>
                <p className="text-sm text-gray-500">{t("入站节点")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{protocolNodes.length}</p>
                <p className="mt-1 text-xs text-gray-500">Xray {xrayNodes} / Snell {snellNodes}</p>
              </CardBody>
            </Card>
            <Card radius="sm" className="border border-default-200">
              <CardBody>
                <p className="text-sm text-gray-500">{t("转发/隧道")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{activeForwardRules}/{forwardRules.length}</p>
                <p className="mt-1 text-xs text-gray-500">{t("活跃规则 / 全部规则")}</p>
              </CardBody>
            </Card>
            <Card radius="sm" className="border border-default-200">
              <CardBody>
                <p className="text-sm text-gray-500">{t("总流量")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatBytes(totalRemoteTraffic)}</p>
                <p className="mt-1 text-xs text-gray-500">{t("{count} 条流量快照", { count: trafficSnapshots.length })}</p>
              </CardBody>
            </Card>
          </div>
          <Card radius="sm" className="mt-4 border border-default-200">
            <CardHeader className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("状态总览")}</h2>
                <p className="text-xs text-gray-500">{t("只看在线、异常、服务和证书状态, 详细信息进入日志。")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="flat" color="success">{t("健康 {count}", { count: runtimeStateOverview?.healthy || 0 })}</Chip>
                <Chip size="sm" variant="flat" color="warning">{t("观察 {count}", { count: runtimeStateOverview?.warning || 0 })}</Chip>
                <Chip size="sm" variant="flat" color="danger">{t("异常 {count}", { count: runtimeStateOverview?.failed || failedTasks })}</Chip>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {servers.slice(0, 6).map(server => (
                  <div key={`dashboard-server-${server.id}`} className="rounded-small border border-default-200 bg-default-50/60 p-3 dark:bg-default-50/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{server.name}</p>
                        <p className="truncate text-xs text-gray-500">{server.host || server.endpoint || "-"}</p>
                      </div>
                      <Chip size="sm" variant="flat" color={heartbeatColor(server) as any}>{heartbeatText(server)}</Chip>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-gray-500">CPU</p><p>{server.cpuUsage == null ? "-" : `${server.cpuUsage.toFixed(1)}%`}</p></div>
                      <div><p className="text-gray-500">{t("内存")}</p><p>{server.memoryUsage == null ? "-" : `${server.memoryUsage.toFixed(1)}%`}</p></div>
                      <div><p className="text-gray-500">{t("证书")}</p><p className="truncate">{server.certificateStatus || "-"}</p></div>
                    </div>
                  </div>
                ))}
                {servers.length === 0 && (
                  <div className="rounded-small border border-dashed border-default-300 p-5 text-center lg:col-span-3">
                    <p className="font-medium text-gray-900 dark:text-white">{t("还没有服务器")}</p>
                    <Button size="sm" color="primary" variant="flat" className="mt-3" onPress={() => openServerModal()}>{t("添加服务器")}</Button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="servers" data-testid="broil-servers">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("服务器")}</h2>
            <Button size="sm" color="primary" variant="flat" onPress={() => openServerModal()}>{t("添加服务器")}</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {servers.map(server => (
              <Card key={`broil-server-${server.id}`} radius="sm" className="border border-default-200">
                <CardBody className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{server.name}</p>
                      <p className="truncate text-xs text-gray-500">{server.host}:{server.sshPort || 22}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Chip size="sm" variant="flat" color={heartbeatColor(server) as any}>{heartbeatText(server)}</Chip>
                      {server.role === "master" && <Chip size="sm" variant="flat" color="warning">{t("主控")}</Chip>}
                      {isLowMemoryServer(server) && <Chip size="sm" variant="flat" color="warning">Nano</Chip>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div><p className="text-xs text-gray-500">CPU</p><p>{server.cpuUsage == null ? "-" : `${server.cpuUsage.toFixed(1)}%`}</p></div>
                    <div><p className="text-xs text-gray-500">{t("内存")}</p><p>{server.memoryUsage == null ? "-" : `${server.memoryUsage.toFixed(1)}%`}{server.memoryTotalMb ? ` / ${server.memoryTotalMb} MB` : ""}</p></div>
                    <div><p className="text-xs text-gray-500">Xray</p><p>{server.xrayServiceStatus || "-"}</p></div>
                    <div><p className="text-xs text-gray-500">Snell</p><p>{server.snellServiceStatus || "-"}</p></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" color="primary" variant="flat" onPress={() => showServerInstallCommand(server)}>{t("加入命令")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openProtocolNodeModal(server)}>{t("新增节点")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openServerForwardModal(server)}>{t("新增转发")}</Button>
                    <Button size="sm" variant="flat" onPress={() => syncServerProtocolNodes(server)}>{t("同步节点")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openServerModal(server)}>{t("编辑")}</Button>
                  </div>
                  {server.lastError && <p className="text-xs text-danger">{server.lastError}</p>}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section id="inbounds" data-testid="broil-inbounds">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("入站节点")}</h2>
            <Button size="sm" color="primary" variant="flat" onPress={() => openProtocolNodeModal()}>{t("新增节点")}</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {protocolNodes.map(node => (
              <Card key={`broil-node-${node.id}`} radius="sm" className="border border-default-200">
                <CardBody className="space-y-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{node.name}</p>
                      <p className="text-xs text-gray-500">{node.serverName || node.serverId} / {node.direction || "inbound"}</p>
                    </div>
                    <Chip size="sm" variant="flat" color={serviceColor(node.state) as any}>{node.state || "-"}</Chip>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-gray-500">{t("协议")}</p><p>{node.protocol}</p></div>
                    <div><p className="text-xs text-gray-500">{t("端口")}</p><p>{node.listen || "*"}:{node.port || "-"}</p></div>
                    <div><p className="text-xs text-gray-500">{t("类型")}</p><p>{node.engine === "snell" ? "Snell" : [node.transport, node.security].filter(Boolean).join(" / ")}</p></div>
                    <div><p className="text-xs text-gray-500">{t("流量")}</p><p>{formatBytes(node.total || ((node.up || 0) + (node.down || 0)))}</p></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => openProtocolNodeModal(undefined, node)}>{t("编辑")}</Button>
                    <Button size="sm" variant="flat" onPress={() => restartNode(node)}>{t("重启")}</Button>
                    <Button size="sm" variant="light" color="danger" onPress={() => removeProtocolNode(node)}>{t("删除")}</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section id="routes" data-testid="broil-routes">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("出站与路由")}</h2>
            <Chip size="sm" variant="flat">IPv4 / IPv6</Chip>
          </div>
          <Card radius="sm" className="border border-default-200">
            <CardBody className="space-y-3">
              {servers.map(server => (
                <div key={`broil-route-${server.id}`} className="grid grid-cols-1 gap-3 rounded-small border border-default-200 bg-default-50/60 p-3 md:grid-cols-[1fr_auto] md:items-center dark:bg-default-50/5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{server.name}</p>
                    <p className="truncate text-xs text-gray-500">{t("出站, 路由规则, IPv4/IPv6 优先级统一在这里调整。")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Button size="sm" variant="flat" onPress={() => showXrayRuntimeOutbounds(server)}>{t("查看出站")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openXraySettingModal(server)}>{t("路由规则")}</Button>
                    <Button size="sm" variant="flat" onPress={() => showXrayRuntimeOutboundTraffic(server)}>{t("出站流量")}</Button>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </section>

        <section id="tunnels" data-testid="broil-tunnels">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("转发/隧道")}</h2>
            <Button size="sm" color="primary" variant="flat" onPress={() => openServerForwardModal()}>{t("新增转发")}</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {forwardRules.map(rule => (
              <Card key={`broil-forward-${rule.id}`} radius="sm" className="border border-default-200">
                <CardBody className="space-y-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{rule.name}</p>
                      <p className="text-xs text-gray-500">{rule.serverName || rule.serverId} / {rule.protocol || "tcp"}</p>
                    </div>
                    <Chip size="sm" variant="flat" color={serviceColor(rule.state) as any}>{rule.state || "-"}</Chip>
                  </div>
                  <p className="text-sm">
                    {rule.listenHost || "0.0.0.0"}:{rule.listenPort} {"->"} {rule.targetHost}:{rule.targetPort}
                  </p>
                  <p className="text-xs text-gray-500">{t("流量")} {formatBytes((rule.up || 0) + (rule.down || 0))}</p>
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

        <section id="traffic" data-testid="broil-traffic">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("流量")}</h2>
            <Button size="sm" variant="flat" onPress={loadData}>{t("刷新")}</Button>
          </div>
          <Card radius="sm" className="border border-default-200">
            <CardBody className="space-y-2">
              {trafficSnapshots.slice(0, 12).map(snapshot => (
                <div key={`broil-traffic-${snapshot.id}`} className="grid grid-cols-1 gap-2 rounded-small border border-default-200 bg-default-50/60 p-3 text-sm md:grid-cols-4 dark:bg-default-50/5">
                  <p className="font-medium text-gray-900 dark:text-white">{snapshot.serverName || snapshot.serverId}</p>
                  <p>{snapshot.inboundRemark || snapshot.email || snapshot.tag || snapshot.sourceType}</p>
                  <p>{formatBytes(snapshot.total || ((snapshot.up || 0) + (snapshot.down || 0)))}</p>
                  <p className="text-xs text-gray-500">{formatTime(snapshot.syncedTime)}</p>
                </div>
              ))}
              {trafficSnapshots.length === 0 && <p className="text-sm text-gray-500">{t("暂无流量快照。")}</p>}
            </CardBody>
          </Card>
        </section>

        <section id="certificates" data-testid="broil-certificates">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("证书")}</h2>
            <Button size="sm" variant="flat" onPress={() => openDeploymentPlanModal()}>{t("申请/续期")}</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {servers.map(server => (
              <Card key={`broil-cert-${server.id}`} radius="sm" className="border border-default-200">
                <CardBody className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{server.name}</p>
                      <p className="truncate text-xs text-gray-500">{server.certificateDomain || server.host || "-"}</p>
                    </div>
                    <Chip size="sm" variant="flat" color={serviceColor(server.certificateStatus) as any}>{server.certificateStatus || "-"}</Chip>
                  </div>
                  <p className="text-xs text-gray-500">{t("到期：{time}", { time: formatTime(server.certificateExpireAt) })}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section id="settings" data-testid="broil-settings">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("设置")}</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="flat" onPress={() => openProfileModal()}>{t("节点模板")}</Button>
              <Button size="sm" variant="flat" onPress={() => openDeployModal()}>{t("手动任务")}</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.8fr)]">
            <Card radius="sm" className="border border-default-200">
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("系统")}</h3>
              </CardHeader>
              <CardBody className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div><p className="text-xs text-gray-500">{t("用户")}</p><p>{t("已启用")}</p></div>
                <div><p className="text-xs text-gray-500">{t("安全")}</p><p>{t("Token 已隐藏")}</p></div>
                <div><p className="text-xs text-gray-500">{t("备份")}</p><p>{t("使用数据库备份")}</p></div>
                <div><p className="text-xs text-gray-500">{t("更新")}</p><p>{tasks.filter(task => ["generated", "claimed", "running"].includes(task.state)).length} {t("个任务")}</p></div>
              </CardBody>
            </Card>
            <Card radius="sm" className="border border-default-200">
              <CardHeader className="flex justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("日志")}</h3>
                <Chip size="sm" variant="flat">{activeAlerts + failedTasks}</Chip>
              </CardHeader>
              <CardBody className="space-y-2">
                {recentAlerts.map(alert => (
                  <div key={`broil-alert-${alert.id}`} className="rounded-small border border-default-200 bg-default-50/60 p-2 text-xs dark:bg-default-50/5">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{alert.message || alert.alertType}</span>
                      <Chip size="sm" variant="flat" color={alertSeverityColor(alert.severity) as any}>{alert.severity || "-"}</Chip>
                    </div>
                    <p className="mt-1 text-gray-500">{alert.serverName || alert.serverId || "-"} · {formatTime(alert.createdTime)}</p>
                  </div>
                ))}
                {tasks.slice(0, 5).map(task => (
                  <div key={`broil-task-log-${task.id}`} className="rounded-small border border-default-200 bg-default-50/60 p-2 text-xs dark:bg-default-50/5">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">#{task.id} {task.serverName || task.serverId}</span>
                      <Chip size="sm" variant="flat" color={task.state === "succeeded" ? "success" : task.state === "failed" ? "danger" : "primary"}>{task.state}</Chip>
                    </div>
                    <p className="mt-1 text-gray-500">{task.protocol} / {task.action} · {formatTime(task.createdTime)}</p>
                  </div>
                ))}
                {recentAuditLogs.slice(0, 4).map(log => (
                  <div key={`broil-audit-${log.id}`} className="rounded-small border border-default-200 bg-default-50/60 p-2 text-xs dark:bg-default-50/5">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{log.action || log.resourceType || "-"}</span>
                      <Chip size="sm" variant="flat" color={auditOutcomeColor(log.outcome) as any}>{auditOutcomeLabel(log.outcome)}</Chip>
                    </div>
                    <p className="mt-1 text-gray-500">{log.serverName || log.serverId || "-"} · {formatTime(log.createdTime)}</p>
                  </div>
                ))}
                {recentAlerts.length === 0 && tasks.length === 0 && recentAuditLogs.length === 0 && <p className="text-sm text-gray-500">{t("暂无日志。")}</p>}
              </CardBody>
            </Card>
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
              <Input label={t("Xray Runtime 地址")} value={serverForm.xrayRuntimeEndpoint} onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeEndpoint: e.target.value }))} variant="bordered" placeholder="https://1.2.3.4:5168" />
              <Input label={t("Xray Runtime Base Path")} value={serverForm.xrayRuntimeBasePath} onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeBasePath: e.target.value }))} variant="bordered" placeholder="/secret-path" />
              <Input label={t("Xray Runtime API Token")} value={serverForm.xrayRuntimeApiToken} onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeApiToken: e.target.value }))} variant="bordered" />
              <Input label={t("Xray Runtime 用户名")} value={serverForm.xrayRuntimeUsername} onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeUsername: e.target.value }))} variant="bordered" />
              <Input label={t("Xray Runtime 密码")} type="password" value={serverForm.xrayRuntimePassword} onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimePassword: e.target.value }))} variant="bordered" />
              <Input label={t("Xray Runtime 2FA")} value={serverForm.xrayRuntimeTwoFactorCode} onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeTwoFactorCode: e.target.value }))} variant="bordered" />
              <Select label={t("Xray Runtime TLS 校验")} selectedKeys={[serverForm.xrayRuntimeAllowInsecure.toString()]} onSelectionChange={keys => setServerForm(prev => ({ ...prev, xrayRuntimeAllowInsecure: Number(Array.from(keys)[0]) }))} variant="bordered">
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
                  {protocolNodeChecks.filter(check => check.state !== "ok").length === 0 && (
                    <div className="rounded-small border border-success-200 bg-success-50/70 px-3 py-2 text-xs text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
                      {t("关键参数已就绪，凭据会自动生成，保存后由 Agent 执行。")}
                    </div>
                  )}
                  {protocolNodeChecks.filter(check => check.state !== "ok").map((check, index) => (
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

      <Modal isOpen={deploymentPlanModalOpen} onOpenChange={setDeploymentPlanModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("一键部署 Xray / Snell")}</ModalHeader>
          <ModalBody>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label={t("目标服务器")}
                  selectionMode="multiple"
                  selectedKeys={deploymentPlanForm.serverIds.map(id => id.toString())}
                  onSelectionChange={keys => {
                    const serverIds = Array.from(keys).map(key => Number(key)).filter(Boolean);
                    const serverId = serverIds[0] || null;
                    const server = servers.find(item => item.id === serverId);
                    patchDeploymentPlanForm({
                      serverId,
                      serverIds,
                      publicHost: server?.host || deploymentPlanForm.publicHost,
                      certificateDomain: server?.host?.includes(".") ? server.host : deploymentPlanForm.certificateDomain,
                      webBasePath: serverId ? `ob-${serverId}` : deploymentPlanForm.webBasePath
                    });
                  }}
                  variant="bordered"
                >
                  {renderServerOptions()}
                </Select>
                <Input label={t("公网主机")} value={deploymentPlanForm.publicHost} onChange={e => patchDeploymentPlanForm({ publicHost: e.target.value })} variant="bordered" />
                <Input label={t("Xray Runtime 版本")} value={deploymentPlanForm.xrayRuntimeVersion} onChange={e => patchDeploymentPlanForm({ xrayRuntimeVersion: e.target.value })} variant="bordered" placeholder={t("留空使用最新版")} />
              </div>
              {selectedDeploymentPlanHasMaster && (
                <MasterRiskNotice context="生成一键部署任务" />
              )}
              {selectedDeploymentPlanLowMemoryServers.length > 0 && (
                <div className={`rounded-small border px-3 py-2 text-xs leading-5 ${
                  selectedDeploymentPlanCriticalNanoServers.length > 0
                    ? "border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300"
                    : "border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
                }`}>
                  <span className="font-semibold">{t("Nano 被控风险：")}</span>
                  {t("已选择 {count} 台低内存服务器。低于 200MB 时主控会阻止完整 Xray 部署；建议只保留 Snell 或端口转发，并先开启 swap。", {
                    count: selectedDeploymentPlanLowMemoryServers.length
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-small border border-default-200 p-4">
                <Switch isSelected={deploymentPlanForm.installXrayRuntime} onValueChange={value => patchDeploymentPlanForm({ installXrayRuntime: value })}>{t("安装 Xray Runtime")}</Switch>
                <Switch isSelected={deploymentPlanForm.configureRuntime} onValueChange={value => patchDeploymentPlanForm({ configureRuntime: value })}>{t("配置 Xray Runtime")}</Switch>
                <Switch isSelected={deploymentPlanForm.installSnell} onValueChange={value => patchDeploymentPlanForm({ installSnell: value })}>{t("安装 Snell")}</Switch>
                <Switch isSelected={deploymentPlanForm.createVlessReality || deploymentPlanForm.createVmessWs || deploymentPlanForm.createTrojanTls || deploymentPlanForm.createShadowsocks} isReadOnly>{t("创建节点")}</Switch>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label={t("Xray Runtime 端口")} type="number" value={deploymentPlanForm.runtimePort.toString()} onChange={e => patchDeploymentPlanForm({ runtimePort: Number(e.target.value) || 5168 })} variant="bordered" />
                <Input label={t("Xray Runtime 用户名")} value={deploymentPlanForm.runtimeUsername} onChange={e => patchDeploymentPlanForm({ runtimeUsername: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                <Input label={t("Xray Runtime 密码")} type="password" value={deploymentPlanForm.runtimePassword} onChange={e => patchDeploymentPlanForm({ runtimePassword: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                <Input label="Web Base Path" value={deploymentPlanForm.webBasePath} onChange={e => patchDeploymentPlanForm({ webBasePath: e.target.value })} variant="bordered" />
                <Input label={t("监听 IP")} value={deploymentPlanForm.listenIp} onChange={e => patchDeploymentPlanForm({ listenIp: e.target.value })} variant="bordered" />
                <Select label={t("证书模式")} selectedKeys={[deploymentPlanForm.certificateMode]} onSelectionChange={keys => patchDeploymentPlanForm({ certificateMode: Array.from(keys)[0] as DeploymentPlanForm["certificateMode"] })} variant="bordered">
                  <SelectItem key="self-signed">{t("自签名")}</SelectItem>
                  <SelectItem key="acme-http">ACME HTTP</SelectItem>
                  <SelectItem key="none">{t("不配置")}</SelectItem>
                </Select>
                <Input label={t("证书域名")} value={deploymentPlanForm.certificateDomain} onChange={e => patchDeploymentPlanForm({ certificateDomain: e.target.value })} variant="bordered" />
                <Input label={t("ACME 邮箱")} value={deploymentPlanForm.acmeEmail} onChange={e => patchDeploymentPlanForm({ acmeEmail: e.target.value })} variant="bordered" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 rounded-small border border-default-200 p-4">
                <div className="space-y-3">
                  <Switch isSelected={deploymentPlanForm.createVlessReality} onValueChange={value => patchDeploymentPlanForm({ createVlessReality: value })}>VLESS Reality</Switch>
                  <Input label={t("VLESS 端口")} type="number" value={deploymentPlanForm.vlessPort.toString()} onChange={e => patchDeploymentPlanForm({ vlessPort: Number(e.target.value) || 443 })} variant="bordered" />
                  <Input label="Reality SNI" value={deploymentPlanForm.realitySni} onChange={e => patchDeploymentPlanForm({ realitySni: e.target.value })} variant="bordered" />
                  <Input label="Reality Dest" value={deploymentPlanForm.realityDest} onChange={e => patchDeploymentPlanForm({ realityDest: e.target.value })} variant="bordered" />
                </div>
                <div className="space-y-3">
                  <Switch isSelected={deploymentPlanForm.createVmessWs} onValueChange={value => patchDeploymentPlanForm({ createVmessWs: value })}>VMess WS</Switch>
                  <Input label={t("VMess 端口")} type="number" value={deploymentPlanForm.vmessPort.toString()} onChange={e => patchDeploymentPlanForm({ vmessPort: Number(e.target.value) || 2086 })} variant="bordered" />
                  <Input label="WS Path" value={deploymentPlanForm.wsPath} onChange={e => patchDeploymentPlanForm({ wsPath: e.target.value })} variant="bordered" />
                </div>
                <div className="space-y-3">
                  <Switch isSelected={deploymentPlanForm.createTrojanTls} onValueChange={value => patchDeploymentPlanForm({ createTrojanTls: value })}>Trojan TLS</Switch>
                  <Input label={t("Trojan 端口")} type="number" value={deploymentPlanForm.trojanPort.toString()} onChange={e => patchDeploymentPlanForm({ trojanPort: Number(e.target.value) || 8443 })} variant="bordered" />
                </div>
                <div className="space-y-3">
                  <Switch isSelected={deploymentPlanForm.createShadowsocks} onValueChange={value => patchDeploymentPlanForm({ createShadowsocks: value })}>Shadowsocks</Switch>
                  <Input label={t("SS 端口")} type="number" value={deploymentPlanForm.shadowsocksPort.toString()} onChange={e => patchDeploymentPlanForm({ shadowsocksPort: Number(e.target.value) || 8388 })} variant="bordered" />
                  <Input label={t("SS 加密")} value={deploymentPlanForm.ssMethod} onChange={e => patchDeploymentPlanForm({ ssMethod: e.target.value })} variant="bordered" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t("Snell 端口")} type="number" value={deploymentPlanForm.snellPort.toString()} onChange={e => patchDeploymentPlanForm({ snellPort: Number(e.target.value) || 8390 })} variant="bordered" />
                <div className="space-y-2">
                  <Input label="Snell PSK" value={deploymentPlanForm.snellPsk} onChange={e => patchDeploymentPlanForm({ snellPsk: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                  <Button size="sm" variant="flat" onPress={() => patchDeploymentPlanForm({ snellPsk: randomToken(32) })}>{t("生成 PSK")}</Button>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeploymentPlanModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveDeploymentPlanTask}>{t("生成一键任务")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={xrayRuntimeInboundModalOpen} onOpenChange={setXrayRuntimeInboundModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("入站操作")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label={t("动作")} selectedKeys={[xrayRuntimeInboundForm.mode]} onSelectionChange={keys => patchXrayRuntimeInboundForm({ mode: Array.from(keys)[0] as XrayRuntimeInboundForm["mode"] })} variant="bordered">
                <SelectItem key="add">{t("新增 inbound")}</SelectItem>
                <SelectItem key="update">{t("更新 inbound")}</SelectItem>
                <SelectItem key="delete">{t("删除 inbound")}</SelectItem>
              </Select>
              <Select label={t("编辑方式")} selectedKeys={[xrayRuntimeInboundForm.editMode]} onSelectionChange={keys => patchXrayRuntimeInboundForm({ editMode: Array.from(keys)[0] as XrayRuntimeInboundForm["editMode"] })} variant="bordered">
                <SelectItem key="form">{t("结构化表单")}</SelectItem>
                <SelectItem key="json">{t("高级 JSON")}</SelectItem>
              </Select>
              <Input label={t("服务器 ID")} value={xrayRuntimeInboundForm.serverId?.toString() || ""} isReadOnly variant="bordered" />
              <Input label="Inbound ID" value={xrayRuntimeInboundForm.inboundId} onChange={e => patchXrayRuntimeInboundForm({ inboundId: e.target.value })} variant="bordered" />
              <Input label={t("备注")} value={xrayRuntimeInboundForm.remark} onChange={e => patchXrayRuntimeInboundForm({ remark: e.target.value })} variant="bordered" />
              <Select label={t("启用")} selectedKeys={[xrayRuntimeInboundForm.enable.toString()]} onSelectionChange={keys => patchXrayRuntimeInboundForm({ enable: Number(Array.from(keys)[0]) })} variant="bordered">
                <SelectItem key="1">{t("启用")}</SelectItem>
                <SelectItem key="0">{t("停用")}</SelectItem>
              </Select>
              <Input label={t("监听地址")} value={xrayRuntimeInboundForm.listen} onChange={e => patchXrayRuntimeInboundForm({ listen: e.target.value })} variant="bordered" placeholder={t("留空监听所有地址")} />
              <Input label={t("端口")} type="number" value={xrayRuntimeInboundForm.port.toString()} onChange={e => patchXrayRuntimeInboundForm({ port: Number(e.target.value) || 0 })} variant="bordered" />
              <Select label={t("协议")} selectedKeys={[xrayRuntimeInboundForm.protocol]} onSelectionChange={keys => updateInboundProtocol(Array.from(keys)[0] as XrayRuntimeInboundForm["protocol"])} variant="bordered">
                <SelectItem key="vless">VLESS</SelectItem>
                <SelectItem key="vmess">VMess</SelectItem>
                <SelectItem key="trojan">Trojan</SelectItem>
                <SelectItem key="shadowsocks">Shadowsocks</SelectItem>
              </Select>
              <Select label={t("传输")} selectedKeys={[xrayRuntimeInboundForm.network]} onSelectionChange={keys => patchXrayRuntimeInboundForm({ network: Array.from(keys)[0] as XrayRuntimeInboundForm["network"] })} variant="bordered">
                <SelectItem key="tcp">TCP</SelectItem>
                <SelectItem key="ws">WebSocket</SelectItem>
              </Select>
              <Select label={t("安全")} selectedKeys={[xrayRuntimeInboundForm.security]} onSelectionChange={keys => patchXrayRuntimeInboundForm({ security: Array.from(keys)[0] as XrayRuntimeInboundForm["security"] })} variant="bordered">
                <SelectItem key="none">None</SelectItem>
                <SelectItem key="tls">TLS</SelectItem>
                <SelectItem key="reality">Reality</SelectItem>
              </Select>
            </div>
            {selectedInboundServer?.role === "master" && (
              <MasterRiskNotice context="提交入站操作" />
            )}

            {xrayRuntimeInboundForm.mode !== "delete" && xrayRuntimeInboundForm.editMode === "form" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label={t("客户端 Email")} value={xrayRuntimeInboundForm.clientEmail} onChange={e => patchXrayRuntimeInboundForm({ clientEmail: e.target.value })} variant="bordered" />
                  {xrayRuntimeInboundForm.protocol !== "trojan" && xrayRuntimeInboundForm.protocol !== "shadowsocks" && (
                    <div className="space-y-2">
                      <Input label={t("客户端 UUID")} value={xrayRuntimeInboundForm.clientId} onChange={e => patchXrayRuntimeInboundForm({ clientId: e.target.value })} variant="bordered" />
                      <Button size="sm" variant="flat" onPress={() => patchXrayRuntimeInboundForm({ clientId: randomUuid() })}>{t("生成 UUID")}</Button>
                    </div>
                  )}
                  {(xrayRuntimeInboundForm.protocol === "trojan" || xrayRuntimeInboundForm.protocol === "shadowsocks") && (
                    <Input label={t("客户端密码 / PSK")} value={xrayRuntimeInboundForm.clientPassword} onChange={e => patchXrayRuntimeInboundForm({ clientPassword: e.target.value })} variant="bordered" />
                  )}
                  {xrayRuntimeInboundForm.protocol === "vless" && (
                    <Input label="Flow" value={xrayRuntimeInboundForm.flow} onChange={e => patchXrayRuntimeInboundForm({ flow: e.target.value })} variant="bordered" />
                  )}
                  <Input label={t("流量限制 GB")} type="number" value={xrayRuntimeInboundForm.totalGb.toString()} onChange={e => patchXrayRuntimeInboundForm({ totalGb: Number(e.target.value) || 0 })} variant="bordered" />
                  <Input label={t("有效期天数")} type="number" value={xrayRuntimeInboundForm.expiryDays.toString()} onChange={e => patchXrayRuntimeInboundForm({ expiryDays: Number(e.target.value) || 0 })} variant="bordered" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="SNI / Host" value={xrayRuntimeInboundForm.sni} onChange={e => patchXrayRuntimeInboundForm({ sni: e.target.value })} variant="bordered" />
                  {xrayRuntimeInboundForm.protocol === "vless" && xrayRuntimeInboundForm.security === "reality" && (
                    <>
                        <Input label="Reality Dest" value={xrayRuntimeInboundForm.realityDest} onChange={e => patchXrayRuntimeInboundForm({ realityDest: e.target.value })} variant="bordered" />
                        <div className="space-y-2">
                          <Input label="Reality Private Key" value={xrayRuntimeInboundForm.realityPrivateKey} onChange={e => patchXrayRuntimeInboundForm({ realityPrivateKey: e.target.value })} variant="bordered" />
                        <Button size="sm" variant="flat" onPress={() => patchXrayRuntimeInboundForm({ realityPrivateKey: randomRealityPrivateKey() })}>{t("生成私钥")}</Button>
                      </div>
                      <div className="space-y-2">
                        <Input label="Reality Short ID" value={xrayRuntimeInboundForm.realityShortId} onChange={e => patchXrayRuntimeInboundForm({ realityShortId: e.target.value })} variant="bordered" />
                        <Button size="sm" variant="flat" onPress={() => patchXrayRuntimeInboundForm({ realityShortId: randomHex(8) })}>{t("生成 Short ID")}</Button>
                      </div>
                    </>
                  )}
                  {xrayRuntimeInboundForm.protocol === "vmess" && (
                    <Input label="WebSocket Path" value={xrayRuntimeInboundForm.wsPath} onChange={e => patchXrayRuntimeInboundForm({ wsPath: e.target.value })} variant="bordered" />
                  )}
                  {xrayRuntimeInboundForm.protocol === "shadowsocks" && (
                    <Input label={t("加密方法")} value={xrayRuntimeInboundForm.ssMethod} onChange={e => patchXrayRuntimeInboundForm({ ssMethod: e.target.value })} variant="bordered" />
                  )}
                </div>
              </div>
            )}

            {xrayRuntimeInboundForm.mode !== "delete" && (
              <Textarea
                label={xrayRuntimeInboundForm.editMode === "json" ? "Inbound Payload JSON" : t("生成的 Payload 预览")}
                minRows={14}
                value={xrayRuntimeInboundForm.editMode === "json" ? xrayRuntimeInboundForm.payloadJson : inboundPayloadPreview(xrayRuntimeInboundForm)}
                onChange={e => patchXrayRuntimeInboundForm({ payloadJson: e.target.value })}
                readOnly={xrayRuntimeInboundForm.editMode === "form"}
                variant="bordered"
                classNames={{ input: "font-mono text-xs" }}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setXrayRuntimeInboundModalOpen(false)}>{t("取消")}</Button>
            <Button color={xrayRuntimeInboundForm.mode === "delete" ? "danger" : "primary"} isLoading={submitting} onPress={() => saveXrayRuntimeInbound()}>{t("提交")}</Button>
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
