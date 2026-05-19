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
  ensureDefaultProtocolProfiles,
  getControlServerList,
  getControlServerToken,
  getDeployTaskList,
  getDeployTaskScript,
  getProtocolProfileList,
  rotateControlServerToken,
  updateControlServer,
  updateProtocolProfile
} from "@/api";
import type { ControlServer, DeployTask, ProtocolProfile } from "@/types";

interface ServerForm {
  id?: number;
  name: string;
  role: string;
  endpoint: string;
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

const blankServerForm: ServerForm = {
  name: "",
  role: "agent",
  endpoint: "",
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
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [serverForm, setServerForm] = useState<ServerForm>(blankServerForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(blankProfileForm);
  const [deployForm, setDeployForm] = useState<DeployForm>(blankDeployForm);

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
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" onPress={() => openDeployModal(server)}>部署</Button>
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

      <Modal isOpen={serverModalOpen} onOpenChange={setServerModalOpen} size="2xl">
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
