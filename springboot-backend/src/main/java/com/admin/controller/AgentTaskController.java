package com.admin.controller;

import com.admin.common.dto.AgentTaskClaimDto;
import com.admin.common.dto.AgentTaskReportDto;
import com.admin.common.lang.R;
import com.admin.service.DeployTaskService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/agent-task")
public class AgentTaskController {

    @Resource
    private DeployTaskService deployTaskService;

    @PostMapping("/claim")
    public R claim(@Validated @RequestBody AgentTaskClaimDto dto,
                   @RequestHeader(value = "X-Agent-Token", required = false) String token) {
        return deployTaskService.claimAgentTask(dto, token);
    }

    @PostMapping("/report")
    public R report(@Validated @RequestBody AgentTaskReportDto dto,
                    @RequestHeader(value = "X-Agent-Token", required = false) String token) {
        return deployTaskService.reportAgentTask(dto, token);
    }
}
