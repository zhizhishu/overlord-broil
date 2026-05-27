package com.admin.controller;

import com.admin.common.dto.AgentJoinRequestDto;
import com.admin.common.lang.R;
import com.admin.service.ControlServerService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/agent-join")
public class AgentJoinController {

    @Resource
    private ControlServerService controlServerService;

    @PostMapping("/register")
    public R register(@Validated @RequestBody AgentJoinRequestDto dto) {
        return controlServerService.joinAgent(dto);
    }
}
