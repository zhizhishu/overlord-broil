import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import toast from "react-hot-toast";

import {
  createControlServer,
  createDeployTask,
  createProtocolProfile,
  deleteControlServer,
  deleteDeployTask,
  deleteProtocolProfile,
  addThreeXuiInbound,
  deleteThreeXuiInbound,
  ensureDefaultProtocolProfiles,
  getControlServerList,
  getControlServerToken,
  getDeployTaskList,
  getDeployTaskScript,
  getProtocolProfileList,
  getThreeXuiConfig,
  getThreeXuiOutbounds,
  listThreeXuiInbounds,
  rotateControlServerToken,
  restartThreeXuiXray,
  saveThreeXuiOutbounds,
  testThreeXuiConnection,
  updateThreeXuiInbound,
  updateControlServer,
  updateProtocolProfile
} from "@/api";
import type { ControlServer, DeployTask, ProtocolProfile } from "@/types";

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

interface ThreeXuiInboundForm {
  serverId: number | null;
  inboundId: string;
  mode: "add" | "update" | "delete";
  payloadJson: string;
}

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

const defaultInboundPayload = {
  up: 0,
  down: 0,
  total: 0,
  remark: "flux-vless",
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
  payloadJson: JSON.stringify(defaultInboundPayload, null, 2)
};

export default function OrchestratorPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState<ControlServer[]>([]);
  const [profiles, setProfiles] = useState<ProtocolProfile[]>([]);
  const [tasks, setTasks] = useState<DeployTask[]>([]);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [threeXuiInboundModalOpen, setThreeXuiInboundModalOpen] = useState(false);
  const [xraySettingModalOpen, setXraySettingModalOpen] = useState(false);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [xraySettingServerId, setXraySettingServerId] = useState<number | null>(null);
  const [xraySettingText, setXraySettingText] = useState("");
  const [outboundTestUrl, setOutboundTestUrl] = useState("https://www.google.com/generate_204");
  const [serverForm, setServerForm] = useState<ServerForm>(blankServerForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(blankProfileForm);
  const [deployForm, setDeployForm] = useState<DeployForm>(blankDeployForm);
  const [threeXuiInboundForm, setThreeXuiInboundForm] = useState<ThreeXuiInboundForm>(blankThreeXuiInboundForm);

  const onlineServers = useMemo(() => {
    const now = Date.now();
    return servers.filter(server => server.lastHeartbeat && now - server.lastHeartbeat < 90000).length;
  }, [servers]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await ensureDefaultProtocolProfiles();
      const [serverRes, profileRes, taskRes] = await Promise.all([
        getControlServerList(),
        getProtocolProfileList(),
        getDeployTaskList()
      ]);

      if (serverRes.code === 0) setServers(serverRes.data || []);
      if (profileRes.code === 0) setProfiles(profileRes.data || []);
      if (taskRes.code === 0) setTasks(taskRes.data || []);
      if (serverRes.code !== 0 || profileRes.code !== 0 || taskRes.code !== 0) {
        toast.error("主控数据加载不完整");
      }
    } catch (error) {
      toast.error("主控中心加载失败");
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

  const saveServer = async () => {
    if (!serverForm.name.trim() || !serverForm.host.trim()) {
      toast.error("请填写服务器名称和主机地址");
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
      toast.success(serverForm.id ? "服务器已更新" : "服务器已添加");
      setServerModalOpen(false);
      loadData();
    } else {
      toast.error(res.msg || "保存服务器失败");
    }
  };

  const saveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.protocol.trim()) {
      toast.error("请填写协议模板名称和协议");
      return;
    }

    setSubmitting(true);
    const res = profileForm.id ? await updateProtocolProfile(profileForm) : await createProtocolProfile(profileForm);
    setSubmitting(false);

    if (res.code === 0) {
      toast.success(profileForm.id ? "协议模板已更新" : "协议模板已添加");
      setProfileModalOpen(false);
      loadData();
    } else {
      toast.error(res.msg || "保存协议模板失败");
    }
  };

  const saveDeployTask = async () => {
    if (!deployForm.serverId) {
      toast.error("请选择目标服务器");
      return;
    }
    if (!deployForm.protocol.trim()) {
      toast.error("请选择协议");
      return;
    }

    setSubmitting(true);
    const res = await createDeployTask(deployForm);
    setSubmitting(false);

    if (res.code === 0) {
      toast.success("部署任务已生成");
      setDeployModalOpen(false);
      setScriptTitle(`任务 #${res.data.id} 脚本`);
      setScriptText(res.data.script || "");
      setScriptModalOpen(true);
      loadData();
    } else {
      toast.error(res.msg || "生成部署任务失败");
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
      toast.error(res.msg || "读取 token 失败");
    }
  };

  const showTaskScript = async (task: DeployTask) => {
    const res = await getDeployTaskScript(task.id);
    if (res.code === 0) {
      setScriptTitle(`任务 #${task.id} ${task.protocol}`);
      setScriptText(res.data || "");
      setScriptModalOpen(true);
    } else {
      toast.error(res.msg || "读取脚本失败");
    }
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
      toast.success("3x-ui 连接正常");
      showThreeXuiResult(`${server.name} 3x-ui 状态`, res.data);
    } else {
      toast.error(res.msg || res.data?.msg || "3x-ui 连接失败");
    }
  };

  const showThreeXuiInbounds = async (server: ControlServer) => {
    const res = await listThreeXuiInbounds(server.id);
    if (isThreeXuiSuccess(res)) {
      showThreeXuiResult(`${server.name} 入站列表`, res.data);
      loadData();
    } else {
      toast.error(res.msg || res.data?.msg || "读取入站失败");
    }
  };

  const showThreeXuiConfig = async (server: ControlServer) => {
    const res = await getThreeXuiConfig(server.id);
    if (isThreeXuiSuccess(res)) {
      showThreeXuiResult(`${server.name} Xray 配置`, res.data);
    } else {
      toast.error(res.msg || res.data?.msg || "读取配置失败");
    }
  };

  const showThreeXuiOutbounds = async (server: ControlServer) => {
    const res = await getThreeXuiOutbounds(server.id);
    if (isThreeXuiSuccess(res)) {
      showThreeXuiResult(`${server.name} 出站配置`, res.data);
    } else {
      toast.error(res.msg || res.data?.msg || "读取出站失败");
    }
  };

  const openThreeXuiInboundModal = (server: ControlServer) => {
    setThreeXuiInboundForm({
      ...blankThreeXuiInboundForm,
      serverId: server.id
    });
    setThreeXuiInboundModalOpen(true);
  };

  const saveThreeXuiInbound = async () => {
    if (!threeXuiInboundForm.serverId) {
      toast.error("请选择服务器");
      return;
    }
    if (threeXuiInboundForm.mode !== "add" && !threeXuiInboundForm.inboundId.trim()) {
      toast.error("更新或删除入站时必须填写 inbound id");
      return;
    }

    setSubmitting(true);
    let res: any;
    try {
      const inboundId = threeXuiInboundForm.inboundId ? Number(threeXuiInboundForm.inboundId) : undefined;
      if (threeXuiInboundForm.mode === "delete") {
        res = await deleteThreeXuiInbound({ serverId: threeXuiInboundForm.serverId, inboundId });
      } else {
        const payload = JSON.parse(threeXuiInboundForm.payloadJson);
        res = threeXuiInboundForm.mode === "add"
          ? await addThreeXuiInbound({ serverId: threeXuiInboundForm.serverId, payload })
          : await updateThreeXuiInbound({ serverId: threeXuiInboundForm.serverId, inboundId, payload });
      }
    } catch (error) {
      setSubmitting(false);
      toast.error("入站 JSON 格式不正确");
      return;
    }
    setSubmitting(false);

    if (isThreeXuiSuccess(res)) {
      toast.success("3x-ui 入站操作已提交");
      setThreeXuiInboundModalOpen(false);
      showThreeXuiResult("3x-ui 入站操作结果", res.data);
    } else {
      toast.error(res.msg || res.data?.msg || "3x-ui 入站操作失败");
    }
  };

  const openXraySettingModal = async (server: ControlServer) => {
    const res = await getThreeXuiConfig(server.id);
    if (!isThreeXuiSuccess(res)) {
      toast.error(res.msg || res.data?.msg || "读取 Xray 配置失败");
      return;
    }

    const config = res.data?.obj || res.data;
    setXraySettingServerId(server.id);
    setXraySettingText(typeof config === "string" ? config : JSON.stringify(config, null, 2));
    setOutboundTestUrl("https://www.google.com/generate_204");
    setXraySettingModalOpen(true);
  };

  const saveXraySetting = async () => {
    if (!xraySettingServerId) {
      toast.error("缺少服务器");
      return;
    }
    try {
      JSON.parse(xraySettingText);
    } catch (error) {
      toast.error("Xray 配置 JSON 格式不正确");
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
      toast.success("3x-ui 出站配置已保存");
      setXraySettingModalOpen(false);
      showThreeXuiResult("3x-ui 出站保存结果", res.data);
    } else {
      toast.error(res.msg || res.data?.msg || "保存出站配置失败");
    }
  };

  const restartXray = async (server: ControlServer) => {
    const res = await restartThreeXuiXray(server.id);
    if (isThreeXuiSuccess(res)) {
      toast.success("已请求重启 Xray");
      showThreeXuiResult(`${server.name} Xray 重启结果`, res.data);
    } else {
      toast.error(res.msg || res.data?.msg || "重启 Xray 失败");
    }
  };

  const copyScript = async () => {
    await navigator.clipboard.writeText(scriptText);
    toast.success("已复制");
  };

  const removeServer = async (server: ControlServer) => {
    const res = await deleteControlServer(server.id);
    if (res.code === 0) {
      toast.success("服务器已删除");
      loadData();
    } else {
      toast.error(res.msg || "删除失败");
    }
  };

  const removeProfile = async (profile: ProtocolProfile) => {
    const res = await deleteProtocolProfile(profile.id);
    if (res.code === 0) {
      toast.success("协议模板已删除");
      loadData();
    } else {
      toast.error(res.msg || "删除失败");
    }
  };

  const removeTask = async (task: DeployTask) => {
    const res = await deleteDeployTask(task.id);
    if (res.code === 0) {
      toast.success("部署任务已删除");
      loadData();
    } else {
      toast.error(res.msg || "删除失败");
    }
  };

  const formatTime = (time?: number) => {
    if (!time) return "-";
    return new Date(time).toLocaleString();
  };

  const heartbeatColor = (server: ControlServer) => {
    if (server.lastError) return "danger";
    if (!server.lastHeartbeat) return "warning";
    return Date.now() - server.lastHeartbeat < 90000 ? "success" : "warning";
  };

  const heartbeatText = (server: ControlServer) => {
    if (server.lastError) return "异常";
    if (!server.lastHeartbeat) return "未连接";
    return Date.now() - server.lastHeartbeat < 90000 ? "在线" : "离线";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 dark:bg-black">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">主控中心</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">服务器编排、3x-ui 协议模板、Snell 部署任务</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button color="primary" onPress={() => openDeployModal()}>新建部署</Button>
            <Button variant="flat" onPress={() => openServerModal()}>添加服务器</Button>
            <Button variant="flat" onPress={() => openProfileModal()}>添加模板</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card radius="sm">
            <CardBody>
              <p className="text-sm text-gray-500">服务器</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{servers.length}</p>
              <p className="text-xs text-gray-500 mt-1">{onlineServers} 台在线</p>
            </CardBody>
          </Card>
          <Card radius="sm">
            <CardBody>
              <p className="text-sm text-gray-500">协议模板</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{profiles.length}</p>
              <p className="text-xs text-gray-500 mt-1">Xray / Snell</p>
            </CardBody>
          </Card>
          <Card radius="sm">
            <CardBody>
              <p className="text-sm text-gray-500">部署任务</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{tasks.length}</p>
              <p className="text-xs text-gray-500 mt-1">生成脚本后由副控执行</p>
            </CardBody>
          </Card>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">服务器</h2>
            <Button size="sm" variant="light" onPress={loadData}>刷新</Button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {servers.map(server => (
              <Card key={server.id} radius="sm">
                <CardHeader className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{server.name}</p>
                    <p className="text-xs text-gray-500">{server.host}:{server.sshPort || 22}</p>
                  </div>
                  <Chip color={heartbeatColor(server) as any} variant="flat" size="sm">{heartbeatText(server)}</Chip>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">入口</p>
                      <p className="truncate">{server.endpoint || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">3x-ui</p>
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
                      <p className="text-gray-500">内存</p>
                      <p>{server.memoryUsage == null ? "-" : `${server.memoryUsage.toFixed(1)}%`}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">心跳：{formatTime(server.lastHeartbeat)}</p>
                  <p className="text-xs text-gray-500">3x-ui 同步：{formatTime(server.xuiLastSync)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => openDeployModal(server)}>部署</Button>
                    <Button size="sm" variant="flat" onPress={() => testXui(server)}>测 3x-ui</Button>
                    <Button size="sm" variant="flat" onPress={() => showThreeXuiInbounds(server)}>入站</Button>
                    <Button size="sm" variant="flat" onPress={() => openThreeXuiInboundModal(server)}>入站操作</Button>
                    <Button size="sm" variant="flat" onPress={() => showThreeXuiConfig(server)}>配置</Button>
                    <Button size="sm" variant="flat" onPress={() => showThreeXuiOutbounds(server)}>出站</Button>
                    <Button size="sm" variant="flat" onPress={() => openXraySettingModal(server)}>保存出站</Button>
                    <Button size="sm" variant="flat" onPress={() => restartXray(server)}>重启 Xray</Button>
                    <Button size="sm" variant="flat" onPress={() => openServerModal(server)}>编辑</Button>
                    <Button size="sm" variant="flat" onPress={() => showServerToken(server)}>Token</Button>
                    <Button size="sm" variant="flat" color="warning" onPress={() => showServerToken(server, true)}>轮换</Button>
                    <Button size="sm" variant="light" color="danger" onPress={() => removeServer(server)}>删除</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">协议模板</h2>
            <Button size="sm" variant="light" onPress={() => openProfileModal()}>新增</Button>
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
                  <p className="text-sm">端口：{profile.listenPort || "-"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => openProfileModal(profile)}>编辑</Button>
                    <Button size="sm" variant="light" color="danger" onPress={() => removeProfile(profile)}>删除</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">部署任务</h2>
            <Button size="sm" variant="light" onPress={() => openDeployModal()}>生成</Button>
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
                    <Chip size="sm" variant="flat" color={task.state === "succeeded" ? "success" : task.state === "failed" ? "danger" : "primary"}>
                      {task.state}
                    </Chip>
                  </div>
                  <p className="text-xs text-gray-500">创建：{formatTime(task.createdTime)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => showTaskScript(task)}>脚本</Button>
                    <Button size="sm" variant="light" color="danger" onPress={() => removeTask(task)}>删除</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <Modal isOpen={serverModalOpen} onOpenChange={setServerModalOpen} size="4xl">
        <ModalContent>
          <ModalHeader>{serverForm.id ? "编辑服务器" : "添加服务器"}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="名称" value={serverForm.name} onChange={e => setServerForm(prev => ({ ...prev, name: e.target.value }))} variant="bordered" />
              <Select label="角色" selectedKeys={[serverForm.role]} onSelectionChange={keys => setServerForm(prev => ({ ...prev, role: Array.from(keys)[0] as string }))} variant="bordered">
                <SelectItem key="master">主控</SelectItem>
                <SelectItem key="agent">副控</SelectItem>
              </Select>
              <Input label="主机" value={serverForm.host} onChange={e => setServerForm(prev => ({ ...prev, host: e.target.value }))} variant="bordered" />
              <Input label="SSH 端口" type="number" value={serverForm.sshPort.toString()} onChange={e => setServerForm(prev => ({ ...prev, sshPort: Number(e.target.value) || 22 }))} variant="bordered" />
              <Input label="SSH 用户" value={serverForm.sshUser} onChange={e => setServerForm(prev => ({ ...prev, sshUser: e.target.value }))} variant="bordered" />
              <Input label="副控 API" value={serverForm.endpoint} onChange={e => setServerForm(prev => ({ ...prev, endpoint: e.target.value }))} variant="bordered" />
              <Input label="3x-ui 面板地址" value={serverForm.xuiEndpoint} onChange={e => setServerForm(prev => ({ ...prev, xuiEndpoint: e.target.value }))} variant="bordered" placeholder="https://1.2.3.4:54321" />
              <Input label="3x-ui Base Path" value={serverForm.xuiBasePath} onChange={e => setServerForm(prev => ({ ...prev, xuiBasePath: e.target.value }))} variant="bordered" placeholder="/secret-path" />
              <Input label="3x-ui API Token" value={serverForm.xuiApiToken} onChange={e => setServerForm(prev => ({ ...prev, xuiApiToken: e.target.value }))} variant="bordered" />
              <Input label="3x-ui 用户名" value={serverForm.xuiUsername} onChange={e => setServerForm(prev => ({ ...prev, xuiUsername: e.target.value }))} variant="bordered" />
              <Input label="3x-ui 密码" type="password" value={serverForm.xuiPassword} onChange={e => setServerForm(prev => ({ ...prev, xuiPassword: e.target.value }))} variant="bordered" />
              <Input label="3x-ui 2FA" value={serverForm.xuiTwoFactorCode} onChange={e => setServerForm(prev => ({ ...prev, xuiTwoFactorCode: e.target.value }))} variant="bordered" />
              <Select label="3x-ui TLS 校验" selectedKeys={[serverForm.xuiAllowInsecure.toString()]} onSelectionChange={keys => setServerForm(prev => ({ ...prev, xuiAllowInsecure: Number(Array.from(keys)[0]) }))} variant="bordered">
                <SelectItem key="0">校验证书</SelectItem>
                <SelectItem key="1">允许自签名</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setServerModalOpen(false)}>取消</Button>
            <Button color="primary" isLoading={submitting} onPress={saveServer}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={profileModalOpen} onOpenChange={setProfileModalOpen} size="3xl">
        <ModalContent>
          <ModalHeader>{profileForm.id ? "编辑协议模板" : "添加协议模板"}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="名称" value={profileForm.name} onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))} variant="bordered" />
              <Input label="协议" value={profileForm.protocol} onChange={e => setProfileForm(prev => ({ ...prev, protocol: e.target.value }))} variant="bordered" />
              <Input label="版本族" value={profileForm.versionFamily} onChange={e => setProfileForm(prev => ({ ...prev, versionFamily: e.target.value }))} variant="bordered" />
              <Input label="端口" type="number" value={profileForm.listenPort.toString()} onChange={e => setProfileForm(prev => ({ ...prev, listenPort: Number(e.target.value) || 0 }))} variant="bordered" />
              <Input label="传输" value={profileForm.transport} onChange={e => setProfileForm(prev => ({ ...prev, transport: e.target.value }))} variant="bordered" />
              <Input label="备注" value={profileForm.remark} onChange={e => setProfileForm(prev => ({ ...prev, remark: e.target.value }))} variant="bordered" />
            </div>
            <Textarea label="配置 JSON" minRows={5} value={profileForm.configJson} onChange={e => setProfileForm(prev => ({ ...prev, configJson: e.target.value }))} variant="bordered" />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setProfileModalOpen(false)}>取消</Button>
            <Button color="primary" isLoading={submitting} onPress={saveProfile}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={deployModalOpen} onOpenChange={setDeployModalOpen} size="2xl">
        <ModalContent>
          <ModalHeader>生成部署任务</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="目标服务器" selectedKeys={deployForm.serverId ? [deployForm.serverId.toString()] : []} onSelectionChange={keys => setDeployForm(prev => ({ ...prev, serverId: Number(Array.from(keys)[0]) }))} variant="bordered">
                {servers.map(server => <SelectItem key={server.id.toString()}>{server.name}</SelectItem>)}
              </Select>
              <Select label="协议模板" selectedKeys={deployForm.profileId ? [deployForm.profileId.toString()] : []} onSelectionChange={keys => selectProfileForDeploy(Number(Array.from(keys)[0]))} variant="bordered">
                {profiles.map(profile => <SelectItem key={profile.id.toString()}>{profile.name}</SelectItem>)}
              </Select>
              <Select label="动作" selectedKeys={[deployForm.action]} onSelectionChange={keys => setDeployForm(prev => ({ ...prev, action: Array.from(keys)[0] as string }))} variant="bordered">
                <SelectItem key="present">安装/更新</SelectItem>
                <SelectItem key="restarted">重启</SelectItem>
                <SelectItem key="status">状态</SelectItem>
                <SelectItem key="absent">卸载</SelectItem>
              </Select>
              <Input label="协议" value={deployForm.protocol} onChange={e => setDeployForm(prev => ({ ...prev, protocol: e.target.value }))} variant="bordered" />
              <Input label="版本族" value={deployForm.versionFamily} onChange={e => setDeployForm(prev => ({ ...prev, versionFamily: e.target.value }))} variant="bordered" />
              <Input label="固定版本" value={deployForm.exactVersion} onChange={e => setDeployForm(prev => ({ ...prev, exactVersion: e.target.value }))} variant="bordered" />
              <Input label="监听端口" type="number" value={deployForm.listenPort.toString()} onChange={e => setDeployForm(prev => ({ ...prev, listenPort: Number(e.target.value) || 0 }))} variant="bordered" />
              <Input label="Snell PSK" value={deployForm.psk} onChange={e => setDeployForm(prev => ({ ...prev, psk: e.target.value }))} variant="bordered" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeployModalOpen(false)}>取消</Button>
            <Button color="primary" isLoading={submitting} onPress={saveDeployTask}>生成</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={threeXuiInboundModalOpen} onOpenChange={setThreeXuiInboundModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>3x-ui 入站操作</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="动作" selectedKeys={[threeXuiInboundForm.mode]} onSelectionChange={keys => setThreeXuiInboundForm(prev => ({ ...prev, mode: Array.from(keys)[0] as ThreeXuiInboundForm["mode"] }))} variant="bordered">
                <SelectItem key="add">新增 inbound</SelectItem>
                <SelectItem key="update">更新 inbound</SelectItem>
                <SelectItem key="delete">删除 inbound</SelectItem>
              </Select>
              <Input label="Inbound ID" value={threeXuiInboundForm.inboundId} onChange={e => setThreeXuiInboundForm(prev => ({ ...prev, inboundId: e.target.value }))} variant="bordered" />
              <Input label="服务器 ID" value={threeXuiInboundForm.serverId?.toString() || ""} isReadOnly variant="bordered" />
            </div>
            {threeXuiInboundForm.mode !== "delete" && (
              <Textarea
                label="Inbound Payload JSON"
                minRows={18}
                value={threeXuiInboundForm.payloadJson}
                onChange={e => setThreeXuiInboundForm(prev => ({ ...prev, payloadJson: e.target.value }))}
                variant="bordered"
                classNames={{ input: "font-mono text-xs" }}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setThreeXuiInboundModalOpen(false)}>取消</Button>
            <Button color={threeXuiInboundForm.mode === "delete" ? "danger" : "primary"} isLoading={submitting} onPress={saveThreeXuiInbound}>提交</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={xraySettingModalOpen} onOpenChange={setXraySettingModalOpen} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>保存 3x-ui Xray / Outbound 配置</ModalHeader>
          <ModalBody>
            <Input label="Outbound 测试地址" value={outboundTestUrl} onChange={e => setOutboundTestUrl(e.target.value)} variant="bordered" />
            <Textarea
              label="完整 Xray 配置 JSON"
              minRows={22}
              value={xraySettingText}
              onChange={e => setXraySettingText(e.target.value)}
              variant="bordered"
              classNames={{ input: "font-mono text-xs" }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setXraySettingModalOpen(false)}>取消</Button>
            <Button color="primary" isLoading={submitting} onPress={saveXraySetting}>保存到 3x-ui</Button>
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
            <Button variant="light" onPress={() => setScriptModalOpen(false)}>关闭</Button>
            <Button color="primary" onPress={copyScript}>复制</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
