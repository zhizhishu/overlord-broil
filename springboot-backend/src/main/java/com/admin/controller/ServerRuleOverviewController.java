package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.ServerRuleOverviewDto;
import com.admin.common.lang.R;
import com.admin.service.ServerRuleOverviewService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/server-rule")
public class ServerRuleOverviewController {

    @Resource
    private ServerRuleOverviewService serverRuleOverviewService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/overview")
    public R overview(@RequestBody ServerRuleOverviewDto dto) {
        return serverRuleOverviewService.overview(dto);
    }
}
