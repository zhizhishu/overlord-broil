package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.ProtocolProfileDto;
import com.admin.common.dto.ProtocolProfileUpdateDto;
import com.admin.common.lang.R;
import com.admin.service.ProtocolProfileService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/protocol-profile")
public class ProtocolProfileController {

    @Resource
    private ProtocolProfileService protocolProfileService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody ProtocolProfileDto dto) {
        return protocolProfileService.createProfile(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list() {
        return protocolProfileService.getAllProfiles();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@Validated @RequestBody ProtocolProfileUpdateDto dto) {
        return protocolProfileService.updateProfile(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return protocolProfileService.deleteProfile(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/ensure-defaults")
    public R ensureDefaults() {
        return protocolProfileService.ensureDefaultProfiles();
    }
}
