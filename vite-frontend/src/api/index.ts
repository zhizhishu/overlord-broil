import Network from './network';

// 登陆相关接口
export interface LoginData {
  username: string;
  password: string;
  captchaId: string;
}

export interface LoginResponse {
  token: string;
  role_id: number;
  name: string;
  requirePasswordChange?: boolean;
}

export const login = (data: LoginData) => Network.post<LoginResponse>("/user/login", data);

// 用户CRUD操作 - 全部使用POST请求
export const createUser = (data: any) => Network.post("/user/create", data);
export const getAllUsers = (pageData: any = {}) => Network.post("/user/list", pageData);
export const updateUser = (data: any) => Network.post("/user/update", data);
export const deleteUser = (id: number) => Network.post("/user/delete", { id });
export const getUserPackageInfo = () => Network.post("/user/package");

// 节点CRUD操作 - 全部使用POST请求
export const createNode = (data: any) => Network.post("/node/create", data);
export const getNodeList = () => Network.post("/node/list");
export const updateNode = (data: any) => Network.post("/node/update", data);
export const deleteNode = (id: number) => Network.post("/node/delete", { id });
export const getNodeInstallCommand = (id: number) => Network.post("/node/install", { id });
export const checkNodeStatus = (nodeId?: number) => {
  const params = nodeId ? { nodeId } : {};
  return Network.post("/node/check-status", params);
};

// 主控/副控服务器
export const createControlServer = (data: any) => Network.post("/control-server/create", data);
export const getControlServerList = () => Network.post("/control-server/list");
export const updateControlServer = (data: any) => Network.post("/control-server/update", data);
export const deleteControlServer = (id: number) => Network.post("/control-server/delete", { id });
export const getControlServerToken = (id: number) => Network.post("/control-server/token", { id });
export const getControlServerInstallCommand = (id: number) => Network.post("/control-server/install-command", { id });
export const rotateControlServerToken = (id: number) => Network.post("/control-server/rotate-token", { id });

// Xray Runtime / Snell 协议模板
export const createProtocolProfile = (data: any) => Network.post("/protocol-profile/create", data);
export const getProtocolProfileList = () => Network.post("/protocol-profile/list");
export const updateProtocolProfile = (data: any) => Network.post("/protocol-profile/update", data);
export const deleteProtocolProfile = (id: number) => Network.post("/protocol-profile/delete", { id });
export const ensureDefaultProtocolProfiles = () => Network.post("/protocol-profile/ensure-defaults");

// 统一协议节点：Xray/Xray Runtime inbound 与 Snell 节点
export const createProtocolNode = (data: any) => Network.post("/protocol-node/create", data);
export const getProtocolNodeList = (data: any = {}) => Network.post("/protocol-node/list", data);
export const updateProtocolNode = (data: any) => Network.post("/protocol-node/update", data);
export const deleteProtocolNode = (id: number) => Network.post("/protocol-node/delete", { id });
export const restartProtocolNode = (id: number) => Network.post("/protocol-node/restart", { id });
export const syncProtocolNodes = (serverId: number) => Network.post("/protocol-node/sync", { serverId });

// 被控服务器端口转发和规则总览
export const createServerForwardRule = (data: any) => Network.post("/server-forward/create", data);
export const getServerForwardRuleList = (data: any = {}) => Network.post("/server-forward/list", data);
export const updateServerForwardRule = (data: any) => Network.post("/server-forward/update", data);
export const deleteServerForwardRule = (id: number) => Network.post("/server-forward/delete", { id });
export const restartServerForwardRule = (id: number) => Network.post("/server-forward/restart", { id });
export const getServerRuleOverview = (serverId: number) => Network.post("/server-rule/overview", { serverId });

// 多服务器协议部署任务
export const createDeployTask = (data: any) => Network.post("/deploy-task/create", data);
export const createDeploymentPlanTask = (data: any) => Network.post("/deploy-task/plans", data);
export const getDeployTaskList = () => Network.post("/deploy-task/list");
export const getRuntimeStateOverview = () => Network.post("/deploy-task/runtime-state/overview");
export const getDeployTaskScript = (id: number) => Network.post("/deploy-task/script", { id });
export const updateDeployTaskState = (data: any) => Network.post("/deploy-task/state", data);
export const retryDeployTask = (id: number) => Network.post("/deploy-task/retry", { id });
export const deleteDeployTask = (id: number) => Network.post("/deploy-task/delete", { id });

// Runtime Provider 注册表：Xray Runtime / Snell / Forward / Certificate / Firewall
export const getRuntimeProviderList = () => Network.post("/runtime-provider/list");
export const resolveRuntimeProvider = (data: { protocol?: string; action?: string }) => Network.post("/runtime-provider/resolve", data);

// 主控监控告警
export const listMonitorAlerts = (data: any = {}) => Network.post("/monitor-alert/list", data);
export const acknowledgeMonitorAlert = (id: number) => Network.post("/monitor-alert/ack", { id });

// 主控操作审计
export const listOperationAuditLogs = (data: any = {}) => Network.post("/operation-audit/list", data);

// Xray Runtime 远端出入站管理
export const testXrayRuntimeConnection = (serverId: number) => Network.post("/runtimes/xray/test", { serverId });
export const listXrayRuntimeInbounds = (serverId: number) => Network.post("/runtimes/xray/inbounds/list", { serverId });
export const addXrayRuntimeInbound = (data: any) => Network.post("/runtimes/xray/inbounds/add", data);
export const updateXrayRuntimeInbound = (data: any) => Network.post("/runtimes/xray/inbounds/update", data);
export const deleteXrayRuntimeInbound = (data: any) => Network.post("/runtimes/xray/inbounds/delete", data);
export const setXrayRuntimeInboundEnable = (data: any) => Network.post("/runtimes/xray/inbounds/set-enable", data);
export const addXrayRuntimeClient = (data: any) => Network.post("/runtimes/xray/clients/add", data);
export const updateXrayRuntimeClient = (data: any) => Network.post("/runtimes/xray/clients/update", data);
export const deleteXrayRuntimeClient = (data: any) => Network.post("/runtimes/xray/clients/delete", data);
export const resetXrayRuntimeClientTraffic = (data: any) => Network.post("/runtimes/xray/clients/reset-traffic", data);
export const getXrayRuntimeConfig = (serverId: number) => Network.post("/runtimes/xray/config", { serverId });
export const getXrayRuntimeOutbounds = (serverId: number) => Network.post("/runtimes/xray/outbounds", { serverId });
export const getXrayRuntimeOutboundTraffic = (serverId: number) => Network.post("/runtimes/xray/outbounds/traffic", { serverId });
export const syncXrayRuntimeTraffic = (serverId: number) => Network.post("/runtimes/xray/traffic/sync", { serverId });
export const listXrayRuntimeTraffic = (data: any) => Network.post("/runtimes/xray/traffic/list", data);
export const saveXrayRuntimeOutbounds = (data: any) => Network.post("/runtimes/xray/outbounds/save", data);
export const restartXrayRuntimeXray = (serverId: number) => Network.post("/runtimes/xray/restart-xray", { serverId });

// 隧道CRUD操作 - 全部使用POST请求
export const createTunnel = (data: any) => Network.post("/tunnel/create", data);
export const getTunnelList = () => Network.post("/tunnel/list");
export const getTunnelById = (id: number) => Network.post("/tunnel/get", { id });
export const updateTunnel = (data: any) => Network.post("/tunnel/update", data);
export const deleteTunnel = (id: number) => Network.post("/tunnel/delete", { id });
export const diagnoseTunnel = (tunnelId: number) => Network.post("/tunnel/diagnose", { tunnelId });

// 用户隧道权限管理操作 - 全部使用POST请求
export const assignUserTunnel = (data: any) => Network.post("/tunnel/user/assign", data);
export const getUserTunnelList = (queryData: any = {}) => Network.post("/tunnel/user/list", queryData);
export const removeUserTunnel = (params: any) => Network.post("/tunnel/user/remove", params);
export const updateUserTunnel = (data: any) => Network.post("/tunnel/user/update", data);
export const userTunnel = () => Network.post("/tunnel/user/tunnel");

// 转发CRUD操作 - 全部使用POST请求
export const createForward = (data: any) => Network.post("/forward/create", data);
export const getForwardList = () => Network.post("/forward/list");
export const updateForward = (data: any) => Network.post("/forward/update", data);
export const deleteForward = (id: number) => Network.post("/forward/delete", { id });
export const forceDeleteForward = (id: number) => Network.post("/forward/force-delete", { id });

// 转发服务控制操作 - 通过Java后端接口
export const pauseForwardService = (forwardId: number) => Network.post("/forward/pause", { id: forwardId });
export const resumeForwardService = (forwardId: number) => Network.post("/forward/resume", { id: forwardId });

// 转发诊断操作
export const diagnoseForward = (forwardId: number) => Network.post("/forward/diagnose", { forwardId });

// 转发排序操作
export const updateForwardOrder = (data: { forwards: Array<{ id: number; inx: number }> }) => Network.post("/forward/update-order", data);

// 限速规则CRUD操作 - 全部使用POST请求
export const createSpeedLimit = (data: any) => Network.post("/speed-limit/create", data);
export const getSpeedLimitList = () => Network.post("/speed-limit/list");
export const updateSpeedLimit = (data: any) => Network.post("/speed-limit/update", data);
export const deleteSpeedLimit = (id: number) => Network.post("/speed-limit/delete", { id });

// 修改密码接口
export const updatePassword = (data: any) => Network.post("/user/updatePassword", data);

// 重置流量接口
export const resetUserFlow = (data: { id: number; type: number }) => Network.post("/user/reset", data);

// 网站配置相关接口
export const getConfigs = () => Network.post("/config/list");
export const getConfigByName = (name: string) => Network.post("/config/get", { name });
export const updateConfigs = (configMap: Record<string, string>) => Network.post("/config/update", configMap);
export const updateConfig = (name: string, value: string) => Network.post("/config/update-single", { name, value });


// 验证码相关接口
export const checkCaptcha = () => Network.post("/captcha/check");
export const generateCaptcha = () => Network.post(`/captcha/generate`);
export const verifyCaptcha = (data: { captchaId: string; trackData: string }) => Network.post("/captcha/verify", data);
