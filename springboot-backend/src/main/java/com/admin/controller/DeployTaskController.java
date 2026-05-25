package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeployTaskStateDto;
import com.admin.common.dto.OrchestrationPlanDto;
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
    @PostMapping("/create")
    public R create(@Validated @RequestBody DeployTaskDto dto) {
        return deployTaskService.createTask(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/orchestrate")
    public R orchestrate(@Validated @RequestBody OrchestrationPlanDto dto) {
        return deployTaskService.createOrchestrationTask(dto);
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

    @LogAnnotation
    @RequireRole
    @PostMapping("/state")
    public R state(@Validated @RequestBody DeployTaskStateDto dto) {
        return deployTaskService.updateTaskState(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/retry")
    public R retry(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return deployTaskService.retryTask(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return deployTaskService.deleteTask(id);
    }
}
