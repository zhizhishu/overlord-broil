export const controlCenterSections = [
  { id: "dashboard", label: "仪表盘" },
  { id: "servers", label: "服务器" },
  { id: "inbounds", label: "入站节点" },
  { id: "routes", label: "出站与路由" },
  { id: "tunnels", label: "转发/隧道" },
  { id: "traffic", label: "流量" },
  { id: "certificates", label: "证书" },
  { id: "settings", label: "设置" }
] as const;

export const controlCenterSectionIds = controlCenterSections.map(section => section.id);

export type ControlCenterSectionId = typeof controlCenterSections[number]["id"];
