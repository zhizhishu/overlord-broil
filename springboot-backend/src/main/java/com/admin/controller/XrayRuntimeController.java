package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.XrayRuntimeInboundDto;
import com.admin.common.dto.XrayRuntimeServerDto;
import com.admin.common.dto.XrayRuntimeTrafficQueryDto;
import com.admin.common.dto.XrayRuntimeXraySettingDto;
import com.admin.common.lang.R;
import com.admin.service.XrayRuntimeService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/node-service")
public class XrayRuntimeController {

    @Resource
    private XrayRuntimeService xrayRuntimeService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/test")
    public R test(@Validated @RequestBody XrayRuntimeServerDto dto) {
        return xrayRuntimeService.testConnection(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/list")
    public R listInbounds(@Validated @RequestBody XrayRuntimeServerDto dto) {
        return xrayRuntimeService.listInbounds(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/add")
    public R addInbound(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.addInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/update")
    public R updateInbound(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.updateInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/delete")
    public R deleteInbound(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.deleteInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/set-enable")
    public R setInboundEnable(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.setInboundEnable(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/add")
    public R addClient(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.addClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/update")
    public R updateClient(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.updateClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/delete")
    public R deleteClient(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.deleteClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/reset-traffic")
    public R resetClientTraffic(@Validated @RequestBody XrayRuntimeInboundDto dto) {
        return xrayRuntimeService.resetClientTraffic(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/config")
    public R config(@Validated @RequestBody XrayRuntimeServerDto dto) {
        return xrayRuntimeService.getConfig(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds")
    public R outbounds(@Validated @RequestBody XrayRuntimeServerDto dto) {
        return xrayRuntimeService.getOutbounds(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds/traffic")
    public R outboundsTraffic(@Validated @RequestBody XrayRuntimeServerDto dto) {
        return xrayRuntimeService.getOutboundsTraffic(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/traffic/sync")
    public R syncTraffic(@Validated @RequestBody XrayRuntimeServerDto dto) {
        return xrayRuntimeService.syncTraffic(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/traffic/list")
    public R listTraffic(@RequestBody XrayRuntimeTrafficQueryDto dto) {
        return xrayRuntimeService.listTrafficSnapshots(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds/save")
    public R saveOutbounds(@Validated @RequestBody XrayRuntimeXraySettingDto dto) {
        return xrayRuntimeService.saveXraySetting(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/restart-service")
    public R restartService(@Validated @RequestBody XrayRuntimeServerDto dto) {
        return xrayRuntimeService.restartXray(dto);
    }
}
