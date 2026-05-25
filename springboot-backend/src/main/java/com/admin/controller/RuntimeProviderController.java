package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.lang.R;
import com.admin.runtime.RuntimeProviderService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/runtime-provider")
public class RuntimeProviderController {

    @Resource
    private RuntimeProviderService runtimeProviderService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list() {
        return R.ok(runtimeProviderService.listProviders());
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/resolve")
    public R resolve(@RequestBody(required = false) Map<String, Object> params) {
        String protocol = params == null || params.get("protocol") == null ? "" : params.get("protocol").toString();
        String action = params == null || params.get("action") == null ? "" : params.get("action").toString();
        return R.ok(runtimeProviderService.assign(protocol, action));
    }
}
