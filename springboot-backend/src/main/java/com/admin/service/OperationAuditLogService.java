package com.admin.service;

import com.admin.common.dto.OperationAuditLogQueryDto;
import com.admin.common.lang.R;
import com.admin.entity.DeployTask;
import com.admin.entity.OperationAuditLog;
import com.admin.runtime.RuntimeProviderAssignment;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.Map;

public interface OperationAuditLogService extends IService<OperationAuditLog> {

    R listLogs(OperationAuditLogQueryDto dto);

    void record(OperationAuditLog log);

    void recordTaskEvent(String eventType,
                         String actorType,
                         String actorId,
                         String actorName,
                         DeployTask task,
                         RuntimeProviderAssignment provider,
                         boolean danger,
                         String outcome,
                         String summary,
                         Map<String, Object> detail);
}
