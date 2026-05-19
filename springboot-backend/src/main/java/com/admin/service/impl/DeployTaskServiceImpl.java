package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeployTaskStateDto;
import com.admin.common.lang.R;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.entity.ProtocolProfile;
import com.admin.mapper.DeployTaskMapper;
import com.admin.service.ControlServerService;
import com.admin.service.DeployTaskService;
import com.admin.service.ProtocolProfileService;
import com.admin.service.SnellTemplateService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.Map;

@Service
public class DeployTaskServiceImpl extends ServiceImpl<DeployTaskMapper, DeployTask> implements DeployTaskService {

    private static final int STATUS_ACTIVE = 1;
    private static final String STATE_GENERATED = "generated";

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private ProtocolProfileService protocolProfileService;

    @Resource
    private SnellTemplateService snellTemplateService;

    @Override
    public R createTask(DeployTaskDto dto) {
        ControlServer server = controlServerService.getById(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }

        ProtocolProfile profile = null;
        if (dto.getProfileId() != null) {
            profile = protocolProfileService.getById(dto.getProfileId());
            if (profile == null) {
                return R.err("protocol profile not found");
            }
        }

        String protocol = dto.getProtocol().trim().toLowerCase();
        String script = "snell".equals(protocol)
                ? snellTemplateService.buildScript(dto, profile)
                : buildXrayAgentPayload(dto, profile, server);

        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setServerId(server.getId());
        task.setServerName(server.getName());
        task.setProtocol(protocol);
        task.setAction(dto.getAction() == null ? "present" : dto.getAction().trim().toLowerCase());
        task.setState(STATE_GENERATED);
        task.setRequestJson(dto.getRequestJson() == null ? JSON.toJSONString(dto) : dto.getRequestJson());
        task.setScript(script);
        task.setStatus(STATUS_ACTIVE);
        task.setCreatedTime(now);
        task.setUpdatedTime(now);

        return this.save(task) ? R.ok(task) : R.err("deploy task create failed");
    }

    @Override
    public R getAllTasks() {
        return R.ok(this.list());
    }

    @Override
    public R getTaskScript(Long id) {
        DeployTask task = this.getById(id);
        if (task == null) {
            return R.err("deploy task not found");
        }
        return R.ok(task.getScript());
    }

    @Override
    public R updateTaskState(DeployTaskStateDto dto) {
        DeployTask exists = this.getById(dto.getId());
        if (exists == null) {
            return R.err("deploy task not found");
        }

        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setId(dto.getId());
        task.setState(dto.getState());
        task.setResultJson(dto.getResultJson());
        task.setUpdatedTime(now);
        if ("running".equals(dto.getState())) {
            task.setStartedTime(now);
        }
        if ("succeeded".equals(dto.getState()) || "failed".equals(dto.getState())) {
            task.setFinishedTime(now);
        }

        return this.updateById(task) ? R.ok("deploy task state updated") : R.err("deploy task state update failed");
    }

    @Override
    public R deleteTask(Long id) {
        if (this.getById(id) == null) {
            return R.err("deploy task not found");
        }
        return this.removeById(id) ? R.ok("deploy task deleted") : R.err("deploy task delete failed");
    }

    private String buildXrayAgentPayload(DeployTaskDto dto, ProtocolProfile profile, ControlServer server) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("serverId", server.getId());
        payload.put("serverName", server.getName());
        payload.put("protocol", dto.getProtocol());
        payload.put("action", dto.getAction() == null ? "present" : dto.getAction());
        payload.put("listenPort", dto.getListenPort() != null ? dto.getListenPort() : profile == null ? null : profile.getListenPort());
        payload.put("profile", profile);
        payload.put("request", dto);

        String json = JSON.toJSONString(payload);
        return "#!/usr/bin/env bash\n"
                + "set -euo pipefail\n"
                + "cat <<'FLUX_XRAY_PAYLOAD'\n"
                + json + "\n"
                + "FLUX_XRAY_PAYLOAD\n"
                + "echo 'Xray/3x-ui agent payload generated. Send it to the flux agent in the next integration step.'\n";
    }
}
