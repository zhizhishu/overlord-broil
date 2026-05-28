package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.lang.R;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/capabilities")
public class RuntimeProviderController {

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list() {
        return R.err(410, "service registry is internal; use product node, forwarding, certificate and traffic APIs");
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/resolve")
    public R resolve() {
        return R.err(410, "service registry is internal; use product node, forwarding, certificate and traffic APIs");
    }
}
