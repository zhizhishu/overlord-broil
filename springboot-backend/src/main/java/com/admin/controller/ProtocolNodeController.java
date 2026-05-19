package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.ProtocolNodeDto;
import com.admin.common.dto.ProtocolNodeQueryDto;
import com.admin.common.lang.R;
import com.admin.service.ProtocolNodeService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/protocol-node")
public class ProtocolNodeController {

    @Resource
    private ProtocolNodeService protocolNodeService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@RequestBody ProtocolNodeDto dto) {
        return protocolNodeService.createNode(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@RequestBody ProtocolNodeDto dto) {
        return protocolNodeService.updateNode(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list(@RequestBody(required = false) ProtocolNodeQueryDto dto) {
        return protocolNodeService.listNodes(dto == null ? new ProtocolNodeQueryDto() : dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody ProtocolNodeDto dto) {
        return protocolNodeService.deleteNode(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/restart")
    public R restart(@RequestBody ProtocolNodeDto dto) {
        return protocolNodeService.restartNode(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/sync")
    public R sync(@RequestBody ProtocolNodeQueryDto dto) {
        return protocolNodeService.syncNodes(dto);
    }
}
