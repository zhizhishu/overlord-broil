package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.ThreeXuiInboundDto;
import com.admin.common.dto.ThreeXuiServerDto;
import com.admin.common.dto.ThreeXuiXraySettingDto;
import com.admin.common.lang.R;
import com.admin.service.ThreeXuiService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/three-xui")
public class ThreeXuiController {

    @Resource
    private ThreeXuiService threeXuiService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/test")
    public R test(@Validated @RequestBody ThreeXuiServerDto dto) {
        return threeXuiService.testConnection(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/list")
    public R listInbounds(@Validated @RequestBody ThreeXuiServerDto dto) {
        return threeXuiService.listInbounds(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/add")
    public R addInbound(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.addInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/update")
    public R updateInbound(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.updateInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/delete")
    public R deleteInbound(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.deleteInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/set-enable")
    public R setInboundEnable(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.setInboundEnable(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/add")
    public R addClient(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.addClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/update")
    public R updateClient(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.updateClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/delete")
    public R deleteClient(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.deleteClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/reset-traffic")
    public R resetClientTraffic(@Validated @RequestBody ThreeXuiInboundDto dto) {
        return threeXuiService.resetClientTraffic(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/config")
    public R config(@Validated @RequestBody ThreeXuiServerDto dto) {
        return threeXuiService.getConfig(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds")
    public R outbounds(@Validated @RequestBody ThreeXuiServerDto dto) {
        return threeXuiService.getOutbounds(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds/save")
    public R saveOutbounds(@Validated @RequestBody ThreeXuiXraySettingDto dto) {
        return threeXuiService.saveXraySetting(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/restart-xray")
    public R restartXray(@Validated @RequestBody ThreeXuiServerDto dto) {
        return threeXuiService.restartXray(dto);
    }
}
