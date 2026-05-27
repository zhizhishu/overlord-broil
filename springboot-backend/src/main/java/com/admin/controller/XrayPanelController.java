package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.XrayPanelInboundDto;
import com.admin.common.dto.XrayPanelServerDto;
import com.admin.common.dto.XrayPanelTrafficQueryDto;
import com.admin.common.dto.XrayPanelXraySettingDto;
import com.admin.common.lang.R;
import com.admin.service.XrayPanelService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/runtimes/xray")
public class XrayPanelController {

    @Resource
    private XrayPanelService xrayPanelService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/test")
    public R test(@Validated @RequestBody XrayPanelServerDto dto) {
        return xrayPanelService.testConnection(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/list")
    public R listInbounds(@Validated @RequestBody XrayPanelServerDto dto) {
        return xrayPanelService.listInbounds(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/add")
    public R addInbound(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.addInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/update")
    public R updateInbound(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.updateInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/delete")
    public R deleteInbound(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.deleteInbound(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/inbounds/set-enable")
    public R setInboundEnable(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.setInboundEnable(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/add")
    public R addClient(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.addClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/update")
    public R updateClient(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.updateClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/delete")
    public R deleteClient(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.deleteClient(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/clients/reset-traffic")
    public R resetClientTraffic(@Validated @RequestBody XrayPanelInboundDto dto) {
        return xrayPanelService.resetClientTraffic(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/config")
    public R config(@Validated @RequestBody XrayPanelServerDto dto) {
        return xrayPanelService.getConfig(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds")
    public R outbounds(@Validated @RequestBody XrayPanelServerDto dto) {
        return xrayPanelService.getOutbounds(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds/traffic")
    public R outboundsTraffic(@Validated @RequestBody XrayPanelServerDto dto) {
        return xrayPanelService.getOutboundsTraffic(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/traffic/sync")
    public R syncTraffic(@Validated @RequestBody XrayPanelServerDto dto) {
        return xrayPanelService.syncTraffic(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/traffic/list")
    public R listTraffic(@RequestBody XrayPanelTrafficQueryDto dto) {
        return xrayPanelService.listTrafficSnapshots(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/outbounds/save")
    public R saveOutbounds(@Validated @RequestBody XrayPanelXraySettingDto dto) {
        return xrayPanelService.saveXraySetting(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/restart-xray")
    public R restartXray(@Validated @RequestBody XrayPanelServerDto dto) {
        return xrayPanelService.restartXray(dto);
    }
}
