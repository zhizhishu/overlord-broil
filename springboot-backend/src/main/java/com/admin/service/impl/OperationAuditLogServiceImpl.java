package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.admin.common.dto.OperationAuditLogQueryDto;
import com.admin.common.lang.R;
import com.admin.entity.DeployTask;
import com.admin.entity.OperationAuditLog;
import com.admin.mapper.OperationAuditLogMapper;
import com.admin.runtime.RuntimeProviderAssignment;
import com.admin.service.OperationAuditLogService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
public class OperationAuditLogServiceImpl extends ServiceImpl<OperationAuditLogMapper, OperationAuditLog> implements OperationAuditLogService {

    private static final int STATUS_ACTIVE = 1;

    @Override
    public R listLogs(OperationAuditLogQueryDto dto) {
        QueryWrapper<OperationAuditLog> query = new QueryWrapper<>();
        if (dto != null) {
            if (notBlank(dto.getActorType())) {
                query.eq("actor_type", dto.getActorType().trim());
            }
            if (notBlank(dto.getEventType())) {
                query.eq("event_type", dto.getEventType().trim());
            }
            if (notBlank(dto.getResourceType())) {
                query.eq("resource_type", dto.getResourceType().trim());
            }
            if (notBlank(dto.getResourceId())) {
                query.eq("resource_id", dto.getResourceId().trim());
            }
            if (dto.getServerId() != null) {
                query.eq("server_id", dto.getServerId());
            }
            if (notBlank(dto.getProviderKey())) {
                query.eq("provider_key", dto.getProviderKey().trim());
            }
            if (notBlank(dto.getOutcome())) {
                query.eq("outcome", dto.getOutcome().trim());
            }
            if (dto.getDanger() != null) {
                query.eq("danger", dto.getDanger());
            }
        }
        query.eq("status", STATUS_ACTIVE).orderByDesc("created_time").orderByDesc("id");
        int limit = dto == null || dto.getLimit() == null ? 100 : Math.max(1, Math.min(dto.getLimit(), 500));
        query.last("LIMIT " + limit);
        return R.ok(this.list(query));
    }

    @Override
    public void record(OperationAuditLog auditLog) {
        if (auditLog == null) {
            return;
        }
        long now = System.currentTimeMillis();
        if (auditLog.getCreatedTime() == null) {
            auditLog.setCreatedTime(now);
        }
        auditLog.setUpdatedTime(now);
        if (auditLog.getStatus() == null) {
            auditLog.setStatus(STATUS_ACTIVE);
        }
        if (auditLog.getDanger() == null) {
            auditLog.setDanger(0);
        }
        try {
            this.save(auditLog);
        } catch (Exception ex) {
            log.warn("operation audit write failed: {}", ex.getMessage());
        }
    }

    @Override
    public void recordTaskEvent(String eventType,
                                String actorType,
                                String actorId,
                                String actorName,
                                DeployTask task,
                                RuntimeProviderAssignment provider,
                                boolean danger,
                                String outcome,
                                String summary,
                                Map<String, Object> detail) {
        OperationAuditLog log = new OperationAuditLog();
        log.setActorType(actorType);
        log.setActorId(actorId);
        log.setActorName(actorName);
        log.setEventType(eventType);
        log.setResourceType("deploy_task");
        log.setResourceId(task == null || task.getId() == null ? null : String.valueOf(task.getId()));
        if (task != null) {
            log.setServerId(task.getServerId());
            log.setServerName(task.getServerName());
            log.setAction(task.getAction());
        }
        if (provider != null) {
            log.setProviderKey(provider.getKey());
        }
        log.setDanger(danger ? 1 : 0);
        log.setOutcome(outcome);
        log.setSummary(summary);
        log.setDetailJson(detail == null || detail.isEmpty() ? null : JSON.toJSONString(detail));
        record(log);
    }

    private boolean notBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
