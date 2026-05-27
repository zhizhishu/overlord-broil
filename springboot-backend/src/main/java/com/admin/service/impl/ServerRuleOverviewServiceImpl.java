package com.admin.service.impl;

import com.admin.common.dto.ProtocolNodeQueryDto;
import com.admin.common.dto.ServerForwardRuleQueryDto;
import com.admin.common.dto.ServerRuleOverviewDto;
import com.admin.common.dto.XrayRuntimeServerDto;
import com.admin.common.lang.R;
import com.admin.entity.ControlServer;
import com.admin.service.ControlServerService;
import com.admin.service.ProtocolNodeService;
import com.admin.service.ServerForwardRuleService;
import com.admin.service.ServerRuleOverviewService;
import com.admin.service.XrayRuntimeService;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ServerRuleOverviewServiceImpl implements ServerRuleOverviewService {

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private ProtocolNodeService protocolNodeService;

    @Resource
    private ServerForwardRuleService serverForwardRuleService;

    @Resource
    private XrayRuntimeService xrayRuntimeService;

    @Override
    public R overview(ServerRuleOverviewDto dto) {
        if (dto == null || dto.getServerId() == null) {
            return R.err("server id is required");
        }
        ControlServer server = controlServerService.getById(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }

        ProtocolNodeQueryDto nodeQuery = new ProtocolNodeQueryDto();
        nodeQuery.setServerId(server.getId());
        nodeQuery.setLimit(500);
        ServerForwardRuleQueryDto forwardQuery = new ServerForwardRuleQueryDto();
        forwardQuery.setServerId(server.getId());
        forwardQuery.setLimit(500);
        XrayRuntimeServerDto xrayRuntimeDto = new XrayRuntimeServerDto();
        xrayRuntimeDto.setServerId(server.getId());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("server", server);
        data.put("protocolNodes", protocolNodeService.listNodes(nodeQuery).getData());
        data.put("forwardRules", serverForwardRuleService.listRules(forwardQuery).getData());
        data.put("xrayRuntimeInbounds", safeData(xrayRuntimeService.listInbounds(xrayRuntimeDto)));
        data.put("xrayRuntimeOutbounds", safeData(xrayRuntimeService.getOutbounds(xrayRuntimeDto)));
        return R.ok(data);
    }

    private Object safeData(R result) {
        Map<String, Object> wrapped = new LinkedHashMap<>();
        wrapped.put("code", result.getCode());
        wrapped.put("msg", result.getMsg());
        wrapped.put("data", result.getData());
        return wrapped;
    }
}
