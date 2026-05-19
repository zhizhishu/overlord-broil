package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.ServerForwardRuleDto;
import com.admin.common.dto.ServerForwardRuleQueryDto;
import com.admin.common.lang.R;
import com.admin.service.ServerForwardRuleService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/server-forward")
public class ServerForwardRuleController {

    @Resource
    private ServerForwardRuleService serverForwardRuleService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@RequestBody ServerForwardRuleDto dto) {
        return serverForwardRuleService.createRule(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@RequestBody ServerForwardRuleDto dto) {
        return serverForwardRuleService.updateRule(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list(@RequestBody(required = false) ServerForwardRuleQueryDto dto) {
        return serverForwardRuleService.listRules(dto == null ? new ServerForwardRuleQueryDto() : dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody ServerForwardRuleDto dto) {
        return serverForwardRuleService.deleteRule(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/restart")
    public R restart(@RequestBody ServerForwardRuleDto dto) {
        return serverForwardRuleService.restartRule(dto);
    }
}
