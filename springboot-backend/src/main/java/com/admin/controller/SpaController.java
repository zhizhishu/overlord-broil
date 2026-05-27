package com.admin.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    @GetMapping({
            "/",
            "/dashboard",
            "/forward",
            "/tunnel",
            "/node",
            "/control-center",
            "/user",
            "/profile",
            "/limit",
            "/config",
            "/settings",
            "/change-password"
    })
    public String index() {
        return "forward:/index.html";
    }
}
