package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeploymentPlanDto;
import com.admin.common.lang.R;
import com.admin.service.DeployTaskService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/deploy-task")
public class DeployTaskController {

    @Resource
    private DeployTaskService deployTaskService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/plans")
    public R createDeploymentPlan(@Validated @RequestBody DeploymentPlanDto dto) {
        return deployTaskService.createDeploymentPlanTask(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/maintenance")
    public R createMaintenanceTask(@Validated @RequestBody DeployTaskDto dto) {
        dto.setProtocol("agent-maintenance");
        return deployTaskService.createTask(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list() {
        return deployTaskService.getAllTasks();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/runtime-state/overview")
    public R runtimeStateOverview() {
        return deployTaskService.getRuntimeStateOverview();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/script")
    public R script(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return deployTaskService.getTaskScript(id);
    }
}
