package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.OperationAuditLogQueryDto;
import com.admin.common.lang.R;
import com.admin.service.OperationAuditLogService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/operation-audit")
public class OperationAuditLogController {

    @Resource
    private OperationAuditLogService operationAuditLogService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list(@RequestBody OperationAuditLogQueryDto dto) {
        return operationAuditLogService.listLogs(dto);
    }
}
