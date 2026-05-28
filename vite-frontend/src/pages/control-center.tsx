import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
  createControlServer,
  createAgentMaintenanceTask,
  createProtocolNode,
  createDeploymentPlanTask,
  createServerForwardRule,
  deleteControlServer,
  deleteProtocolNode,
  deleteServerForwardRule,
  getControlServerList,
  getControlServerInstallCommand,
  getDeployTaskList,
  getRuntimeStateOverview,
  listMonitorAlerts,
  listOperationAuditLogs,
  getProtocolNodeList,
  getServerForwardRuleList,
  getNodeServiceConfig,
  getNodeServiceOutboundTraffic,
  getNodeServiceOutbounds,
  listNodeServiceTraffic,
  restartProtocolNode,
  restartServerForwardRule,
  restartNodeService as restartNodeServiceRequest,
  saveNodeServiceOutbounds,
  syncNodeServiceTraffic,
  syncProtocolNodes,
  updateControlServer,
  updateProtocolNode,
  updateServerForwardRule
} from "@/api";
import type { ControlServer, DeployTask, MonitorAlert, OperationAuditLog, ProtocolNode, RuntimeStateOverview, ServerForwardRule, NodeServiceTrafficSnapshot } from "@/types";

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

interface DeploymentPlanForm {
  serverId: number | null;
  serverIds: number[];
  installNodeService: boolean;
  configureNodeService: boolean;
  nodeServiceVersion: string;
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

interface NodeServiceInboundForm {
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

type StatusColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";
interface PendingUiConfirmation {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  color?: StatusColor;
  testId?: string;
  onConfirm: () => Promise<void> | void;
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

const blankDeploymentPlanForm: DeploymentPlanForm = {
  serverId: null,
  serverIds: [],
  installNodeService: true,
  configureNodeService: true,
  nodeServiceVersion: "",
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

const blankNodeServiceInboundForm: NodeServiceInboundForm = {
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
const CONTROL_CENTER_SECTION_IDS = [
  "dashboard",
  "servers",
  "inbounds",
  "routes",
  "tunnels",
  "traffic",
  "certificates",
  "settings"
];

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

const parseMaybeJson = (value: any) => {
  if (!value) return null;
  if (typeof value === "string") return safeJsonParse(value);
  if (typeof value === "object") return value;
  return null;
};

const textToBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const textToBase64Url = (value: string) => textToBase64(value).replace(/=+$/g, "");

const normalizeClientHost = (server?: ControlServer) => {
  const host = (server?.host || server?.endpoint || "").trim();
  if (!host) return "";
  return host.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
};

const firstClient = (settings: any) => Array.isArray(settings?.clients) ? settings.clients[0] : null;

const buildProtocolNodeShareText = (node: ProtocolNode, server?: ControlServer) => {
  const host = normalizeClientHost(server);
  const port = node.port || 0;
  const name = encodeURIComponent(node.name || `node-${node.id}`);
  const config = parseMaybeJson(node.configJson) || {};
  const credential = parseMaybeJson(node.credentialJson) || {};
  const settings = parseMaybeJson(config.settings) || config.settings || {};
  const stream = parseMaybeJson(config.streamSettings) || config.streamSettings || {};
  const client = firstClient(settings) || {};

  if (!host || !port) {
    return JSON.stringify({ node, warning: "missing server host or node port" }, null, 2);
  }

  if (node.protocol === "vmess") {
    const ws = stream.wsSettings || {};
    const tls = stream.tlsSettings || {};
    return `vmess://${textToBase64(JSON.stringify({
      v: "2",
      ps: node.name || `node-${node.id}`,
      add: host,
      port: String(port),
      id: client.id || "",
      aid: String(client.alterId || 0),
      scy: "auto",
      net: stream.network || node.transport || "ws",
      type: "none",
      host: ws.headers?.Host || tls.serverName || "",
      path: ws.path || "/ws",
      tls: stream.security === "tls" ? "tls" : "",
      sni: tls.serverName || ""
    }))}`;
  }

  if (node.protocol === "trojan") {
    const password = client.password || credential.password || "";
    const tls = stream.tlsSettings || {};
    const params = new URLSearchParams();
    params.set("type", stream.network || node.transport || "tcp");
    params.set("security", stream.security || node.security || "tls");
    if (tls.serverName) params.set("sni", tls.serverName);
    return `trojan://${encodeURIComponent(password)}@${host}:${port}?${params.toString()}#${name}`;
  }

  if (node.protocol === "shadowsocks") {
    const method = settings.method || credential.method || "2022-blake3-aes-128-gcm";
    const password = settings.password || credential.password || "";
    return `ss://${textToBase64Url(`${method}:${password}`)}@${host}:${port}#${name}`;
  }

  if (node.protocol === "snell" || node.engine === "snell") {
    const version = String((config.version || "v4").replace(/^v/i, "")).split(".")[0] || "4";
    const psk = credential.psk || "";
    return `${node.name || `snell-${node.id}`} = snell, ${host}, ${port}, psk=${psk}, version=${version}`;
  }

  if (node.protocol === "vless") {
    const reality = stream.realitySettings || {};
    const tls = stream.tlsSettings || {};
    const id = client.id || "";
    const params = new URLSearchParams();
    params.set("type", stream.network || node.transport || "tcp");
    params.set("security", stream.security || node.security || "none");
    if (client.flow) params.set("flow", client.flow);
    const sni = reality.serverName || reality.serverNames?.[0] || tls.serverName || "";
    if (sni) params.set("sni", sni);
    if (reality.publicKey) params.set("pbk", reality.publicKey);
    if (reality.shortIds?.[0]) params.set("sid", reality.shortIds[0]);
    if (reality.dest) params.set("fp", "chrome");
    if ((stream.security || node.security) === "reality" && !reality.publicKey) {
      return JSON.stringify({
        warning: "VLESS Reality link needs publicKey. Copy this node config and add the public key shown by the controlled node service.",
        host,
        port,
        node
      }, null, 2);
    }
    return `vless://${id}@${host}:${port}?${params.toString()}#${name}`;
  }

  return JSON.stringify({ node, serverHost: host }, null, 2);
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

const asExpiryTime = (days: number) => {
  if (!days || days <= 0) return 0;
  return Date.now() + days * 24 * 60 * 60 * 1000;
};

const asTrafficLimit = (gb: number) => {
  if (!gb || gb <= 0) return 0;
  return Math.round(gb * GB);
};

const clientBase = (form: NodeServiceInboundForm) => ({
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

const buildInboundPayloadFromForm = (form: NodeServiceInboundForm) => {
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

const inboundFormFromNodeForm = (form: ProtocolNodeForm): NodeServiceInboundForm => ({
  ...blankNodeServiceInboundForm,
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

const isLowMemoryServer = (server?: ControlServer) => {
  if (!server) return false;
  if (server.lowMemoryMode === 1) return true;
  return typeof server.memoryTotalMb === "number" && server.memoryTotalMb > 0 && server.memoryTotalMb < NANO_MEMORY_MB;
};

const isNanoCriticalServer = (server?: ControlServer) => {
  return Boolean(server?.memoryTotalMb && server.memoryTotalMb > 0 && server.memoryTotalMb < NANO_CRITICAL_MEMORY_MB);
};

const applyRoutingTemplate = (value: any, template: "ipv4" | "ipv6" | "direct" | "block-cn") => {
  const config = typeof value === "string" ? safeJsonParse(value) : value;
  if (!config || typeof config !== "object") {
    return null;
  }
  const next = JSON.parse(JSON.stringify(config));
  next.routing = next.routing && typeof next.routing === "object" ? next.routing : {};
  const existingRules = Array.isArray(next.routing.rules) ? next.routing.rules : [];
  const withoutBroilRules = existingRules.filter((rule: any) => !String(rule?.tag || "").startsWith("broil-"));

  if (template === "ipv4") {
    next.routing.domainStrategy = "UseIPv4";
  }
  if (template === "ipv6") {
    next.routing.domainStrategy = "UseIPv6";
  }
  if (template === "direct") {
    next.routing.rules = [
      { tag: "broil-direct-private", type: "field", outboundTag: "direct", ip: ["geoip:private"] },
      ...withoutBroilRules
    ];
  }
  if (template === "block-cn") {
    next.routing.rules = [
      { tag: "broil-direct-cn", type: "field", outboundTag: "direct", domain: ["geosite:cn"], ip: ["geoip:cn"] },
      { tag: "broil-block-ads", type: "field", outboundTag: "block", domain: ["geosite:category-ads-all"] },
      ...withoutBroilRules
    ];
  }
  return next;
};

const isLoopbackNodeServiceEndpoint = (server?: ControlServer) => {
  const endpoint = (server?.xrayRuntimeEndpoint || "").trim().toLowerCase();
  return endpoint.includes("://127.0.0.1")
    || endpoint.includes("://localhost")
    || endpoint.includes("://[::1]")
    || endpoint.startsWith("127.0.0.1:")
    || endpoint.startsWith("localhost:");
};

const nodeServiceIssue = (server?: ControlServer) => {
  if (!server) return "未选择服务器";
  if (!server.xrayRuntimeEndpoint) return "协议能力未开通";
  if (isLoopbackNodeServiceEndpoint(server)) return "协议连接地址指向主控本机";
  const status = (server.xrayRuntimeServiceStatus || server.xrayServiceStatus || "").trim();
  if (status && !["active", "running", "ok", "healthy"].includes(status.toLowerCase())) {
    return `协议能力状态：${status}`;
  }
  return null;
};

const deploymentPlanUsesFullNodeServiceStack = (form: DeploymentPlanForm) => {
  return form.installNodeService
    || form.configureNodeService
    || form.createVlessReality
    || form.createVmessWs
    || form.createTrojanTls
    || form.createShadowsocks;
};

const MasterRiskNotice = ({ context }: { context: string }) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-small border border-warning-300 bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
      <span className="font-semibold">{t("主控高风险：")}</span>{t("{context}会作用在控制面服务器上，建议确认协议节点、转发以及证书任务不会影响现有部署。", { context: t(context) })}
    </div>
  );
};

export default function ControlCenterPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState<ControlServer[]>([]);
  const [protocolNodes, setProtocolNodes] = useState<ProtocolNode[]>([]);
  const [forwardRules, setForwardRules] = useState<ServerForwardRule[]>([]);
  const [tasks, setTasks] = useState<DeployTask[]>([]);
  const [runtimeStateOverview, setRuntimeStateOverview] = useState<RuntimeStateOverview | null>(null);
  const [trafficSnapshots, setTrafficSnapshots] = useState<NodeServiceTrafficSnapshot[]>([]);
  const [trafficServerFilter, setTrafficServerFilter] = useState("all");
  const [trafficSourceFilter, setTrafficSourceFilter] = useState("all");
  const [monitorAlerts, setMonitorAlerts] = useState<MonitorAlert[]>([]);
  const [operationAuditLogs, setOperationAuditLogs] = useState<OperationAuditLog[]>([]);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [protocolNodeModalOpen, setProtocolNodeModalOpen] = useState(false);
  const [serverForwardModalOpen, setServerForwardModalOpen] = useState(false);
  const [deploymentPlanModalOpen, setDeploymentPlanModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [xraySettingModalOpen, setXraySettingModalOpen] = useState(false);
  const [serverAdvancedOpen, setServerAdvancedOpen] = useState(false);
  const [protocolAdvancedOpen, setProtocolAdvancedOpen] = useState(false);
  const [deploymentAdvancedOpen, setDeploymentAdvancedOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailText, setDetailText] = useState("");
  const [pendingUiConfirmation, setPendingUiConfirmation] = useState<PendingUiConfirmation | null>(null);
  const [xraySettingServerId, setXraySettingServerId] = useState<number | null>(null);
  const [xraySettingText, setXraySettingText] = useState("");
  const [outboundTestUrl, setOutboundTestUrl] = useState("https://www.google.com/generate_204");
  const [outboundTagHints, setOutboundTagHints] = useState<string[]>(DEFAULT_OUTBOUND_TAGS);
  const [serverForm, setServerForm] = useState<ServerForm>(blankServerForm);
  const [protocolNodeForm, setProtocolNodeForm] = useState<ProtocolNodeForm>(blankProtocolNodeForm);
  const [serverForwardRuleForm, setServerForwardRuleForm] = useState<ServerForwardRuleForm>(blankServerForwardRuleForm);
  const [deploymentPlanForm, setDeploymentPlanForm] = useState<DeploymentPlanForm>(blankDeploymentPlanForm);

  const onlineServers = useMemo(() => {
    const now = Date.now();
    return servers.filter(server => server.lastHeartbeat && now - server.lastHeartbeat < 90000).length;
  }, [servers]);

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

  const outboundTagOptions = useMemo(() => uniqueStrings([
    ...DEFAULT_OUTBOUND_TAGS,
    ...outboundTagHints,
    ...trafficSnapshots
      .filter(snapshot => snapshot.sourceType === "outbound")
      .map(snapshot => snapshot.tag || ""),
    ...collectOutboundTags(xraySettingText)
  ]), [outboundTagHints, trafficSnapshots, xraySettingText]);

  const trafficSourceTypes = useMemo(() => uniqueStrings(trafficSnapshots.map(snapshot => snapshot.sourceType || "")), [trafficSnapshots]);

  const filteredTrafficSnapshots = useMemo(() => {
    return trafficSnapshots.filter(snapshot => {
      const serverMatched = trafficServerFilter === "all" || String(snapshot.serverId) === trafficServerFilter;
      const sourceMatched = trafficSourceFilter === "all" || snapshot.sourceType === trafficSourceFilter;
      return serverMatched && sourceMatched;
    });
  }, [trafficServerFilter, trafficSourceFilter, trafficSnapshots]);

  const selectedProtocolServer = useMemo(() => {
    return servers.find(server => server.id === protocolNodeForm.serverId);
  }, [protocolNodeForm.serverId, servers]);

  const selectedDeploymentPlanServers = useMemo(() => {
    return servers.filter(server => deploymentPlanForm.serverIds.includes(server.id));
  }, [deploymentPlanForm.serverIds, servers]);

  const selectedDeploymentPlanHasMaster = selectedDeploymentPlanServers.some(server => server.role === "master");
  const selectedDeploymentPlanLowMemoryServers = selectedDeploymentPlanServers.filter(isLowMemoryServer);
  const selectedDeploymentPlanCriticalNanoServers = selectedDeploymentPlanServers.filter(isNanoCriticalServer);
  const selectedDeploymentPlanUsesFullNodeServiceStack = deploymentPlanUsesFullNodeServiceStack(deploymentPlanForm);

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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const sectionId = location.hash.replace("#", "");
    if (!CONTROL_CENTER_SECTION_IDS.includes(sectionId)) {
      return;
    }
    const timer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, loading ? 250 : 50);
    return () => window.clearTimeout(timer);
  }, [location.hash, loading]);

  const applyOutboundTemplate = (template: "ipv4" | "ipv6" | "direct" | "block-cn") => {
    const next = applyRoutingTemplate(xraySettingText, template);
    if (!next) {
      toast.error(t("路由配置 JSON 格式不正确"));
      return;
    }
    setXraySettingText(JSON.stringify(next, null, 2));
    rememberOutboundTags(next);
    toast.success(t("路由模板已应用"));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [serverRes, taskRes, nodeRes, forwardRes, trafficRes, alertRes, auditRes, runtimeStateRes] = await Promise.all([
        getControlServerList(),
        getDeployTaskList(),
        getProtocolNodeList({ limit: 300 }),
        getServerForwardRuleList({ limit: 300 }),
        listNodeServiceTraffic({ limit: 300 }),
        listMonitorAlerts({ acknowledged: 0, limit: 100 }),
        listOperationAuditLogs({ limit: 100 }),
        getRuntimeStateOverview()
      ]);

      if (serverRes.code === 0) setServers(serverRes.data || []);
      if (taskRes.code === 0) setTasks(taskRes.data || []);
      if (nodeRes.code === 0) setProtocolNodes(nodeRes.data || []);
      if (forwardRes.code === 0) setForwardRules(forwardRes.data || []);
      if (trafficRes.code === 0) setTrafficSnapshots(trafficRes.data || []);
      if (alertRes.code === 0) setMonitorAlerts(alertRes.data || []);
      if (auditRes.code === 0) setOperationAuditLogs(auditRes.data || []);
      if (runtimeStateRes.code === 0) setRuntimeStateOverview(runtimeStateRes.data || null);
      if (serverRes.code !== 0 || taskRes.code !== 0 || nodeRes.code !== 0 || forwardRes.code !== 0 || trafficRes.code !== 0 || alertRes.code !== 0 || auditRes.code !== 0 || runtimeStateRes.code !== 0) {
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
    setServerAdvancedOpen(Boolean(server?.xrayRuntimeEndpoint || server?.xrayRuntimeBasePath || server?.xrayRuntimeApiToken || server?.xrayRuntimeUsername));
    setServerModalOpen(true);
  };

  const openProtocolNodeModal = (server?: ControlServer, node?: ProtocolNode) => {
    const protocol = (node?.protocol || "vless") as ProtocolNodeForm["protocol"];
    const engine = (node?.engine || (protocol === "snell" ? "snell" : "xray")) as ProtocolNodeForm["engine"];
    const savedConfig = safeJsonParse(node?.configJson);
    setProtocolAdvancedOpen(Boolean(node?.id));
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

  const openDeploymentPlanModal = (server?: ControlServer) => {
    const firstServer = server || servers[0];
    const host = firstServer?.host || "";
    setDeploymentPlanForm({
      ...blankDeploymentPlanForm,
      serverId: firstServer?.id || null,
      serverIds: firstServer?.id ? [firstServer.id] : [],
      publicHost: host,
      certificateMode: "none",
      certificateDomain: "",
      webBasePath: firstServer?.id ? `ob-${firstServer.id}` : "ob-control"
    });
    setDeploymentAdvancedOpen(false);
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
      toast.error(t("Nano 被控低于 200MB，不支持创建完整协议入站；请改用 Snell 或远端端口转发。"));
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
      toast.success(isSnell ? t("Snell 节点任务已生成") : t("协议入站节点已创建"));
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
      toast.success(node.engine === "snell" ? t("Snell 重启任务已生成") : t("已请求重启节点服务"));
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
    if (selectedDeploymentPlanCriticalNanoServers.length > 0 && selectedDeploymentPlanUsesFullNodeServiceStack) {
      toast.error(t("Nano 被控内存低于 200MB，不支持完整协议能力；请关闭重型协议节点，仅保留 Snell 或端口转发。"));
      return;
    }
    const ports = [
      [t("协议底座"), deploymentPlanForm.runtimePort, deploymentPlanForm.installNodeService || deploymentPlanForm.configureNodeService],
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
      const legacyInstallKey = `install${"Xray"}${"Runtime"}`;
      const legacyConfigureKey = `configure${"Runtime"}`;
      const legacyVersionKey = `${"xray"}${"Runtime"}Version`;
      const payload = {
        ...deploymentPlanForm,
        [legacyInstallKey]: deploymentPlanForm.installNodeService,
        [legacyConfigureKey]: deploymentPlanForm.configureNodeService,
        [legacyVersionKey]: deploymentPlanForm.nodeServiceVersion
      } as any;
      delete payload.serverIds;
      delete payload.installNodeService;
      delete payload.configureNodeService;
      delete payload.nodeServiceVersion;
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
      toast.success(t("已生成 {count} 个一键开通任务，等待被控自动领取", { count: results.length }));
      setDeploymentPlanModalOpen(false);
      loadData();
    } else {
      toast.error(failed.msg || t("生成一键部署任务失败"));
    }
  };

  const showServerInstallCommand = async (server: ControlServer) => {
    const res = await getControlServerInstallCommand(server.id);
    if (res.code === 0) {
      setDetailTitle(t("{name} 被控加入命令", { name: server.name }));
      setDetailText(res.data || "");
      setDetailModalOpen(true);
      if (res.data) {
        await copyText(res.data, t("接入命令已复制"));
      }
    } else {
      toast.error(res.msg || t("生成被控加入命令失败"));
    }
  };

  const isNodeServiceSuccess = (res: any) => res.code === 0 && (!res.data || res.data.success !== false);

  const showNodeServiceDetail = (title: string, data: any) => {
    setDetailTitle(title);
    setDetailText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    setDetailModalOpen(true);
  };

  const ensureNodeServiceReady = (server: ControlServer, action: string) => {
    const issue = nodeServiceIssue(server);
    if (!issue) return true;
    toast.error(t("{action} 前需要先一键修复：{issue}", { action: t(action), issue: t(issue) }));
    openDeploymentPlanModal(server);
    return false;
  };

  const showNodeServiceOutbounds = async (server: ControlServer) => {
    if (!ensureNodeServiceReady(server, "查看出站")) return;
    const res = await getNodeServiceOutbounds(server.id);
    if (isNodeServiceSuccess(res)) {
      rememberOutboundTags(res.data);
      showNodeServiceDetail(t("{name} 出站配置", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取出站失败"));
    }
  };

  const showNodeServiceOutboundTraffic = async (server: ControlServer) => {
    if (!ensureNodeServiceReady(server, "查看出站流量")) return;
    const res = await getNodeServiceOutboundTraffic(server.id);
    if (isNodeServiceSuccess(res)) {
      showNodeServiceDetail(t("{name} 出站流量", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("读取出站流量失败"));
    }
  };

  const syncTrafficForSelection = async () => {
    const targetServers = trafficServerFilter === "all"
      ? servers
      : servers.filter(server => String(server.id) === trafficServerFilter);
    if (targetServers.length === 0) {
      toast.error(t("请选择服务器"));
      return;
    }
    const brokenServer = targetServers.find(server => nodeServiceIssue(server));
    if (brokenServer) {
      ensureNodeServiceReady(brokenServer, "同步流量");
      return;
    }
    setSubmitting(true);
    const results = [];
    for (const server of targetServers) {
      results.push(await syncNodeServiceTraffic(server.id));
    }
    setSubmitting(false);
    const failed = results.find(res => !isNodeServiceSuccess(res));
    if (failed) {
      toast.error(failed.msg || failed.data?.msg || t("同步流量失败"));
      return;
    }
    toast.success(t("远端流量已同步入库"));
    loadData();
  };

  const openNodeServiceSettingModal = async (server: ControlServer) => {
    if (!ensureNodeServiceReady(server, "路由规则")) return;
    const res = await getNodeServiceConfig(server.id);
    if (!isNodeServiceSuccess(res)) {
      toast.error(res.msg || res.data?.msg || t("读取路由配置失败"));
      return;
    }

    const config = res.data?.obj || res.data;
    setXraySettingServerId(server.id);
    setXraySettingText(typeof config === "string" ? config : JSON.stringify(config, null, 2));
    rememberOutboundTags(config);
    setOutboundTestUrl("https://www.google.com/generate_204");
    setXraySettingModalOpen(true);
  };

  const saveNodeServiceSetting = async (confirmed = false) => {
    if (!xraySettingServerId) {
      toast.error(t("缺少服务器"));
      return;
    }
    try {
      JSON.parse(xraySettingText);
    } catch (error) {
      toast.error(t("路由配置 JSON 格式不正确"));
      return;
    }
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认保存出站"),
        message: t("确定保存节点路由 / Outbound 出站配置?"),
        detail: t("无效出站 JSON 可能影响远端路由, 请确认内容后继续。"),
        confirmText: t("确认保存"),
        color: "warning",
        testId: "confirm-save-xray-setting",
        onConfirm: () => saveNodeServiceSetting(true)
      });
      return;
    }

    setSubmitting(true);
    const res = await saveNodeServiceOutbounds({
      serverId: xraySettingServerId,
      xraySetting: xraySettingText,
      outboundTestUrl
    });
    setSubmitting(false);

    if (isNodeServiceSuccess(res)) {
      toast.success(t("出站配置已保存"));
      setXraySettingModalOpen(false);
      showNodeServiceDetail(t("出站保存结果"), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("保存出站配置失败"));
    }
  };

  const restartNodeService = async (server: ControlServer, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认重启协议能力"),
        message: t("确定重启 {name} 的协议能力?", { name: server.name }),
        detail: t("该服务器上的活动连接可能会重新连接。"),
        confirmText: t("确认重启"),
        color: "warning",
        testId: "confirm-restart-service",
        onConfirm: () => restartNodeService(server, true)
      });
      return;
    }
    const res = await restartNodeServiceRequest(server.id);
    if (isNodeServiceSuccess(res)) {
      toast.success(t("已请求重启协议能力"));
      showNodeServiceDetail(t("{name} 协议能力重启结果", { name: server.name }), res.data);
    } else {
      toast.error(res.msg || res.data?.msg || t("重启协议能力失败"));
    }
  };

  const uninstallAgent = async (server: ControlServer, confirmed = false) => {
    if (!confirmed) {
      requestUiConfirmation({
        title: t("确认卸载 Agent"),
        message: t("确定要卸载 {name} 的被控 Agent?", { name: server.name }),
        detail: server.role === "master"
          ? t("这是主控服务器记录。确认后会生成卸载任务，请确保不会切断当前控制面。")
          : t("被控 Agent 会领取卸载任务，回报结果后延迟移除服务、脚本和本机凭据。主控记录会保留，方便确认离线状态后再删除。"),
        confirmText: t("确认卸载 Agent"),
        color: "danger",
        testId: "confirm-uninstall-agent",
        onConfirm: () => uninstallAgent(server, true)
      });
      return;
    }

    setSubmitting(true);
    const res = await createAgentMaintenanceTask({
      serverId: server.id,
      protocol: "agent-maintenance",
      action: "uninstall-agent",
      requestJson: JSON.stringify({
        dangerConfirmed: true,
        confirmAction: "uninstall-agent"
      })
    });
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(t("卸载任务已生成，等待被控 Agent 自动领取"));
      loadData();
    } else {
      toast.error(res.msg || t("生成卸载任务失败"));
    }
  };

  const copyDetail = async () => {
    await navigator.clipboard.writeText(detailText);
    toast.success(t("已复制"));
  };

  const copyText = async (text: string, successMessage = t("已复制")) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch (error) {
      toast.error(t("浏览器未允许自动复制，请打开详情后手动复制"));
    }
  };

  const copyNodeShare = async (node: ProtocolNode) => {
    const server = servers.find(item => item.id === node.serverId);
    const text = buildProtocolNodeShareText(node, server);
    await copyText(text, t("节点配置已复制"));
  };

  const copyServerSubscription = async (server: ControlServer) => {
    const lines = protocolNodes
      .filter(node => node.serverId === server.id)
      .map(node => buildProtocolNodeShareText(node, server))
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error(t("该服务器还没有可复制的节点"));
      return;
    }
    await copyText(lines.join("\n"), t("订阅内容已复制"));
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
    if (["mixed", "expiring", "unknown", "not-installed", "pending", "generated", "claimed"].includes(normalized)) return "warning";
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
            <Button variant="flat" data-testid="open-server-modal" onPress={() => openServerModal()}>{t("接入被控")}</Button>
            <Button variant="light" onPress={loadData}>{t("刷新")}</Button>
          </div>
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
                <p className="mt-1 text-xs text-gray-500">{t("完整协议 {xray} / 轻量协议 {snell}", { xray: xrayNodes, snell: snellNodes })}</p>
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
                <p className="text-xs text-gray-500">{t("只看在线、异常、服务和证书状态, 详细信息进入近期事件。")}</p>
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
                    <Button size="sm" color="primary" variant="flat" className="mt-3" onPress={() => openServerModal()}>{t("接入被控")}</Button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </section>

        <section id="servers" data-testid="broil-servers">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("服务器")}</h2>
            <Button size="sm" color="primary" variant="flat" onPress={() => openServerModal()}>{t("接入被控")}</Button>
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
                    <div><p className="text-xs text-gray-500">{t("协议服务")}</p><p>{server.xrayServiceStatus || "-"}</p></div>
                    <div><p className="text-xs text-gray-500">{t("轻量服务")}</p><p>{server.snellServiceStatus || "-"}</p></div>
                  </div>
                  {nodeServiceIssue(server) && (
                    <div className="flex flex-col gap-2 rounded-small border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-700 md:flex-row md:items-center md:justify-between dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
                      <span>{t(nodeServiceIssue(server) || "")}</span>
                      <Button size="sm" color="warning" variant="flat" onPress={() => openDeploymentPlanModal(server)}>{t("一键修复")}</Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" color="primary" variant="flat" onPress={() => showServerInstallCommand(server)}>{t("接入命令")}</Button>
                    <Button size="sm" variant="flat" onPress={() => copyServerSubscription(server)}>{t("复制订阅")}</Button>
                    <Button size="sm" color="warning" variant="flat" onPress={() => openDeploymentPlanModal(server)}>{t("一键修复")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openProtocolNodeModal(server)}>{t("新增节点")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openServerForwardModal(server)}>{t("新增转发")}</Button>
                    <Button size="sm" variant="flat" onPress={() => syncServerProtocolNodes(server)}>{t("同步节点")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openServerModal(server)}>{t("编辑")}</Button>
                    <Button size="sm" variant="flat" color="danger" onPress={() => uninstallAgent(server)}>{t("卸载 Agent")}</Button>
                    <Button size="sm" variant="light" color="danger" onPress={() => removeServer(server)}>{t("删除记录")}</Button>
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
                    <Button size="sm" variant="flat" onPress={() => copyNodeShare(node)}>{t("复制配置")}</Button>
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
                    <p className="truncate text-xs text-gray-500">
                      {nodeServiceIssue(server) || t("出站, 路由规则, IPv4/IPv6 优先级统一在这里调整。")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {nodeServiceIssue(server) && (
                      <Button size="sm" color="warning" variant="flat" onPress={() => openDeploymentPlanModal(server)}>{t("先修复")}</Button>
                    )}
                    <Button size="sm" variant="flat" onPress={() => showNodeServiceOutbounds(server)}>{t("查看出站")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openNodeServiceSettingModal(server)}>{t("路由规则")}</Button>
                    <Button size="sm" variant="flat" onPress={() => showNodeServiceOutboundTraffic(server)}>{t("出站流量")}</Button>
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
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("流量")}</h2>
            <div className="flex flex-wrap gap-2">
              <Select
                aria-label={t("服务器")}
                size="sm"
                className="w-44"
                selectedKeys={[trafficServerFilter]}
                onSelectionChange={keys => setTrafficServerFilter(String(Array.from(keys)[0] || "all"))}
                variant="bordered"
                items={[
                  { key: "all", label: t("全部服务器") },
                  ...servers.map(server => ({ key: String(server.id), label: server.name || server.host || String(server.id) }))
                ]}
              >
                {item => <SelectItem key={item.key}>{item.label}</SelectItem>}
              </Select>
              <Select
                aria-label={t("类型")}
                size="sm"
                className="w-40"
                selectedKeys={[trafficSourceFilter]}
                onSelectionChange={keys => setTrafficSourceFilter(String(Array.from(keys)[0] || "all"))}
                variant="bordered"
                items={[
                  { key: "all", label: t("全部类型") },
                  ...trafficSourceTypes.map(type => ({ key: type, label: type }))
                ]}
              >
                {item => <SelectItem key={item.key}>{item.label}</SelectItem>}
              </Select>
              <Button size="sm" variant="flat" isLoading={submitting} onPress={syncTrafficForSelection}>{t("同步流量")}</Button>
              <Button size="sm" variant="flat" onPress={loadData}>{t("刷新")}</Button>
            </div>
          </div>
          <Card radius="sm" className="border border-default-200">
            <CardBody className="space-y-2">
              {filteredTrafficSnapshots.slice(0, 24).map(snapshot => (
                <div key={`broil-traffic-${snapshot.id}`} className="grid grid-cols-1 gap-2 rounded-small border border-default-200 bg-default-50/60 p-3 text-sm md:grid-cols-4 dark:bg-default-50/5">
                  <p className="font-medium text-gray-900 dark:text-white">{snapshot.serverName || snapshot.serverId}</p>
                  <p>{snapshot.inboundRemark || snapshot.email || snapshot.tag || snapshot.sourceType}</p>
                  <p>{formatBytes(snapshot.total || ((snapshot.up || 0) + (snapshot.down || 0)))}</p>
                  <p className="text-xs text-gray-500">{formatTime(snapshot.syncedTime)}</p>
                </div>
              ))}
              {filteredTrafficSnapshots.length === 0 && <p className="text-sm text-gray-500">{t("暂无流量快照。")}</p>}
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
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => openDeploymentPlanModal(server)}>{t("申请/续期")}</Button>
                    <Button size="sm" variant="flat" onPress={() => openNodeServiceSettingModal(server)}>{t("查看详情")}</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section id="settings" data-testid="broil-settings">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("设置")}</h2>
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
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("近期事件")}</h3>
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
                {recentAlerts.length === 0 && tasks.length === 0 && recentAuditLogs.length === 0 && <p className="text-sm text-gray-500">{t("暂无事件。")}</p>}
              </CardBody>
            </Card>
          </div>
        </section>

      </div>

      <Modal isOpen={serverModalOpen} onOpenChange={setServerModalOpen} size="4xl">
        <ModalContent>
          <ModalHeader>{serverForm.id ? t("编辑服务器") : t("接入被控")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t("名称")} value={serverForm.name} onChange={e => setServerForm(prev => ({ ...prev, name: e.target.value }))} variant="bordered" />
              <Select label={t("角色")} selectedKeys={[serverForm.role]} onSelectionChange={keys => setServerForm(prev => ({ ...prev, role: Array.from(keys)[0] as string }))} variant="bordered">
                <SelectItem key="master">{t("主控")}</SelectItem>
                <SelectItem key="agent">{t("被控")}</SelectItem>
              </Select>
              <Input label={t("主机")} value={serverForm.host} onChange={e => setServerForm(prev => ({ ...prev, host: e.target.value }))} variant="bordered" />
              <Input label="SSH 端口" type="number" value={serverForm.sshPort.toString()} onChange={e => setServerForm(prev => ({ ...prev, sshPort: Number(e.target.value) || 22 }))} variant="bordered" />
              <Input label="SSH 用户" value={serverForm.sshUser} onChange={e => setServerForm(prev => ({ ...prev, sshUser: e.target.value }))} variant="bordered" />
              <div className="md:col-span-2 rounded-small border border-default-200 bg-white p-3 dark:bg-default-50/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t("协议连接")}</p>
                    <p className="text-xs text-gray-500">{t("出站、路由和流量需要这里可达；一键开通会自动回填。")}</p>
                  </div>
                  <Switch size="sm" isSelected={serverAdvancedOpen} onValueChange={setServerAdvancedOpen}>{t("编辑")}</Switch>
                </div>
                {serverAdvancedOpen && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      label={t("协议连接地址")}
                      value={serverForm.xrayRuntimeEndpoint}
                      onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeEndpoint: e.target.value }))}
                      variant="bordered"
                      placeholder="http://SERVER_IP:5168"
                    />
                    <Input
                      label={t("访问路径")}
                      value={serverForm.xrayRuntimeBasePath}
                      onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeBasePath: e.target.value }))}
                      variant="bordered"
                      placeholder="/ob-1"
                    />
                    <Input
                      label={t("访问令牌")}
                      value={serverForm.xrayRuntimeApiToken}
                      onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeApiToken: e.target.value }))}
                      variant="bordered"
                      placeholder={t("留空保留已有值")}
                    />
                    <Input
                      label={t("协议连接用户")}
                      value={serverForm.xrayRuntimeUsername}
                      onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeUsername: e.target.value }))}
                      variant="bordered"
                      placeholder={t("留空保留已有值")}
                    />
                    <Input
                      label={t("协议连接密码")}
                      type="password"
                      value={serverForm.xrayRuntimePassword}
                      onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimePassword: e.target.value }))}
                      variant="bordered"
                      placeholder={t("留空保留已有值")}
                    />
                    <Input
                      label={t("二次验证码")}
                      value={serverForm.xrayRuntimeTwoFactorCode}
                      onChange={e => setServerForm(prev => ({ ...prev, xrayRuntimeTwoFactorCode: e.target.value }))}
                      variant="bordered"
                      placeholder={t("留空保留已有值")}
                    />
                  </div>
                )}
              </div>
              <div className="md:col-span-2 rounded-small border border-default-200 bg-default-50/60 p-3 text-xs leading-5 text-gray-600 dark:bg-default-50/5 dark:text-gray-300">
                {t("保存后主控会自动复制接入命令。到被控服务器执行这一条命令后，被控会主动回连主控；再按需一键开通协议节点、Snell 或转发。")}
              </div>
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

      <Modal isOpen={protocolNodeModalOpen} onOpenChange={setProtocolNodeModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{protocolNodeForm.id ? t("编辑协议节点") : t("新增协议节点")}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <Input label={t("端口")} type="number" value={protocolNodeForm.port.toString()} onChange={e => patchProtocolNodeForm({ port: Number(e.target.value) || 0 })} variant="bordered" />
              </div>
              <div className="flex items-center justify-between rounded-small border border-default-200 bg-default-50/60 px-3 py-2 dark:bg-default-50/5">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t("自动生成密钥")}</p>
                  <p className="text-xs text-gray-500">{t("默认只填服务器、协议和端口；UUID、Reality 密钥、Snell PSK 会自动生成。")}</p>
                </div>
                <Switch size="sm" isSelected={protocolAdvancedOpen} onValueChange={setProtocolAdvancedOpen}>{t("高级")}</Switch>
              </div>
              {selectedProtocolServer?.role === "master" && (
                <MasterRiskNotice context="保存该协议节点" />
              )}

              {protocolNodeForm.protocol === "snell" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {protocolAdvancedOpen && (
                    <Input label={t("监听地址")} value={protocolNodeForm.listen} onChange={e => patchProtocolNodeForm({ listen: e.target.value })} variant="bordered" placeholder="::0" />
                  )}
                  <div className="space-y-2">
                    <Input label="Snell PSK" value={protocolNodeForm.snellPsk} onChange={e => patchProtocolNodeForm({ snellPsk: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                    <Button size="sm" variant="flat" onPress={() => patchProtocolNodeForm({ snellPsk: randomToken(32) })}>{t("生成 PSK")}</Button>
                  </div>
                  {protocolAdvancedOpen && (
                    <Input label={t("Snell 版本")} value={protocolNodeForm.snellVersion} onChange={e => patchProtocolNodeForm({ snellVersion: e.target.value })} variant="bordered" />
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label={t("SNI / 域名")} value={protocolNodeForm.sni} onChange={e => patchProtocolNodeForm({ sni: e.target.value })} variant="bordered" />
                    <Input label={t("流量限制 GB")} type="number" value={protocolNodeForm.totalGb.toString()} onChange={e => patchProtocolNodeForm({ totalGb: Number(e.target.value) || 0 })} variant="bordered" />
                    <Input label={t("有效期天数")} type="number" value={protocolNodeForm.expiryDays.toString()} onChange={e => patchProtocolNodeForm({ expiryDays: Number(e.target.value) || 0 })} variant="bordered" />
                  </div>
                  {protocolAdvancedOpen && (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label={t("监听地址")} value={protocolNodeForm.listen} onChange={e => patchProtocolNodeForm({ listen: e.target.value })} variant="bordered" placeholder={t("留空监听全部")} />
                    <Select label={t("传输")} selectedKeys={[protocolNodeForm.transport]} onSelectionChange={keys => patchProtocolNodeForm({ transport: Array.from(keys)[0] as ProtocolNodeForm["transport"] })} variant="bordered">
                      <SelectItem key="tcp">TCP</SelectItem>
                      <SelectItem key="ws">WebSocket</SelectItem>
                    </Select>
                    <Select label={t("安全")} selectedKeys={[protocolNodeForm.security]} onSelectionChange={keys => patchProtocolNodeForm({ security: Array.from(keys)[0] as ProtocolNodeForm["security"] })} variant="bordered">
                      <SelectItem key="none">None</SelectItem>
                      <SelectItem key="tls">TLS</SelectItem>
                      <SelectItem key="reality">Reality</SelectItem>
                    </Select>
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
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <Input label={t("出站标签")} value={protocolNodeForm.outboundTag} onChange={e => patchProtocolNodeForm({ outboundTag: e.target.value })} variant="bordered" placeholder={t("留空使用默认路由")} />
                    {renderOutboundTagButtons(tag => patchProtocolNodeForm({ outboundTag: tag }))}
                  </div>
                    </>
                  )}
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

      <Modal isOpen={deploymentPlanModalOpen} onOpenChange={setDeploymentPlanModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("一键开通节点")}</ModalHeader>
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
                <Input label={t("协议底座版本")} value={deploymentPlanForm.nodeServiceVersion} onChange={e => patchDeploymentPlanForm({ nodeServiceVersion: e.target.value })} variant="bordered" placeholder={t("留空使用最新版")} />
              </div>
              {selectedDeploymentPlanHasMaster && (
                <MasterRiskNotice context="生成一键部署任务" />
              )}
              <div className="flex items-center justify-between rounded-small border border-default-200 bg-default-50/60 px-3 py-2 dark:bg-default-50/5">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t("默认套餐开通")}</p>
                  <p className="text-xs text-gray-500">{t("选择服务器和协议即可生成任务；新增单个 Snell 或入站节点也可以直接点新增节点。")}</p>
                </div>
                <Switch size="sm" isSelected={deploymentAdvancedOpen} onValueChange={setDeploymentAdvancedOpen}>{t("高级")}</Switch>
              </div>
              {selectedDeploymentPlanLowMemoryServers.length > 0 && (
                <div className={`rounded-small border px-3 py-2 text-xs leading-5 ${
                  selectedDeploymentPlanCriticalNanoServers.length > 0
                    ? "border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300"
                    : "border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
                }`}>
                  <span className="font-semibold">{t("Nano 被控风险：")}</span>
                  {t("已选择 {count} 台低内存服务器。低于 200MB 时主控会阻止完整协议能力；建议只保留 Snell 或端口转发，并先开启 swap。", {
                    count: selectedDeploymentPlanLowMemoryServers.length
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-small border border-default-200 p-4">
                <Switch isSelected={deploymentPlanForm.installNodeService} onValueChange={value => patchDeploymentPlanForm({ installNodeService: value })}>{t("开通协议能力")}</Switch>
                <Switch isSelected={deploymentPlanForm.configureNodeService} onValueChange={value => patchDeploymentPlanForm({ configureNodeService: value })}>{t("写入协议配置")}</Switch>
                <Switch isSelected={deploymentPlanForm.installSnell} onValueChange={value => patchDeploymentPlanForm({ installSnell: value })}>{t("安装 Snell")}</Switch>
                <Switch isSelected={deploymentPlanForm.createVlessReality || deploymentPlanForm.createVmessWs || deploymentPlanForm.createTrojanTls || deploymentPlanForm.createShadowsocks} isReadOnly>{t("创建节点")}</Switch>
              </div>

              {deploymentAdvancedOpen && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label={t("协议连接端口")} type="number" value={deploymentPlanForm.runtimePort.toString()} onChange={e => patchDeploymentPlanForm({ runtimePort: Number(e.target.value) || 5168 })} variant="bordered" />
                  <Input label={t("协议连接用户")} value={deploymentPlanForm.runtimeUsername} onChange={e => patchDeploymentPlanForm({ runtimeUsername: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                  <Input label={t("协议连接密码")} type="password" value={deploymentPlanForm.runtimePassword} onChange={e => patchDeploymentPlanForm({ runtimePassword: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                  <Input label={t("访问路径")} value={deploymentPlanForm.webBasePath} onChange={e => patchDeploymentPlanForm({ webBasePath: e.target.value })} variant="bordered" />
                  <Input label={t("监听 IP")} value={deploymentPlanForm.listenIp} onChange={e => patchDeploymentPlanForm({ listenIp: e.target.value })} variant="bordered" />
                  <Select label={t("证书模式")} selectedKeys={[deploymentPlanForm.certificateMode]} onSelectionChange={keys => patchDeploymentPlanForm({ certificateMode: Array.from(keys)[0] as DeploymentPlanForm["certificateMode"] })} variant="bordered">
                    <SelectItem key="self-signed">{t("自签名")}</SelectItem>
                    <SelectItem key="acme-http">ACME HTTP</SelectItem>
                    <SelectItem key="none">{t("不配置")}</SelectItem>
                  </Select>
                  <Input label={t("证书域名")} value={deploymentPlanForm.certificateDomain} onChange={e => patchDeploymentPlanForm({ certificateDomain: e.target.value })} variant="bordered" />
                  <Input label={t("ACME 邮箱")} value={deploymentPlanForm.acmeEmail} onChange={e => patchDeploymentPlanForm({ acmeEmail: e.target.value })} variant="bordered" />
                </div>
              )}

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

              {deploymentPlanForm.installSnell && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label={t("Snell 端口")} type="number" value={deploymentPlanForm.snellPort.toString()} onChange={e => patchDeploymentPlanForm({ snellPort: Number(e.target.value) || 8390 })} variant="bordered" />
                  <div className="space-y-2">
                    <Input label="Snell PSK" value={deploymentPlanForm.snellPsk} onChange={e => patchDeploymentPlanForm({ snellPsk: e.target.value })} variant="bordered" placeholder={t("留空自动生成")} />
                    <Button size="sm" variant="flat" onPress={() => patchDeploymentPlanForm({ snellPsk: randomToken(32) })}>{t("生成 PSK")}</Button>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeploymentPlanModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={saveDeploymentPlanTask}>{t("生成开通任务")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={xraySettingModalOpen} onOpenChange={setXraySettingModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("保存节点路由 / 出站配置")}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Input label={t("出站测试地址")} value={outboundTestUrl} onChange={e => setOutboundTestUrl(e.target.value)} variant="bordered" />
              <Button variant="flat" onPress={() => saveNodeServiceSetting()} isLoading={submitting}>{t("保存配置")}</Button>
            </div>
            <div className="rounded-small border border-default-200 bg-white p-3 dark:bg-default-50/5">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t("快速路由")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="flat" onPress={() => applyOutboundTemplate("ipv4")}>{t("IPv4 优先")}</Button>
                <Button size="sm" variant="flat" onPress={() => applyOutboundTemplate("ipv6")}>{t("IPv6 优先")}</Button>
                <Button size="sm" variant="flat" onPress={() => applyOutboundTemplate("direct")}>{t("私网直连")}</Button>
                <Button size="sm" variant="flat" onPress={() => applyOutboundTemplate("block-cn")}>{t("常用规则")}</Button>
              </div>
            </div>
            <div className="rounded-small border border-default-200 bg-default-50/60 p-3 text-xs leading-5 text-gray-600 dark:bg-default-50/5 dark:text-gray-300">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Chip size="sm" variant="flat" color="primary">{t("出站")}</Chip>
                <Chip size="sm" variant="flat" color="primary">{t("路由规则")}</Chip>
                <Chip size="sm" variant="flat" color="primary">IPv4 / IPv6</Chip>
                <Chip size="sm" variant="flat" color="primary">{t("规则优先")}</Chip>
              </div>
              {t("常用场景先点上面的模板；需要精细规则时再编辑下方 JSON。规则顺序按列表从上到下生效。")}
            </div>
            <Textarea
              label={t("路由规则 JSON")}
              minRows={16}
              value={xraySettingText}
              onChange={e => setXraySettingText(e.target.value)}
              variant="bordered"
              classNames={{ input: "font-mono text-xs" }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setXraySettingModalOpen(false)}>{t("取消")}</Button>
            <Button color="primary" isLoading={submitting} onPress={() => saveNodeServiceSetting()}>{t("保存配置")}</Button>
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

      <Modal isOpen={detailModalOpen} onOpenChange={setDetailModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{detailTitle}</ModalHeader>
          <ModalBody>
            <Textarea value={detailText} minRows={18} readOnly variant="bordered" classNames={{ input: "font-mono text-xs" }} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDetailModalOpen(false)}>{t("关闭")}</Button>
            <Button color="primary" onPress={copyDetail}>{t("复制")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
