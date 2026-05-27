package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.ControlServerDto;
import com.admin.common.dto.ControlServerHeartbeatDto;
import com.admin.common.dto.ControlServerUpdateDto;
import com.admin.common.lang.R;
import com.admin.service.ControlServerService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/control-server")
public class ControlServerController {

    @Resource
    private ControlServerService controlServerService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody ControlServerDto dto) {
        return controlServerService.createServer(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list() {
        return controlServerService.getAllServers();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@Validated @RequestBody ControlServerUpdateDto dto) {
        return controlServerService.updateServer(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return controlServerService.deleteServer(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/token")
    public R token(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return controlServerService.getServerToken(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/install-command")
    public R installCommand(@RequestBody Map<String, Object> params, HttpServletRequest request) {
        Long id = Long.valueOf(params.get("id").toString());
        return controlServerService.getServerInstallCommand(id, resolveMasterUrl(request));
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/rotate-token")
    public R rotateToken(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return controlServerService.rotateServerToken(id);
    }

    @PostMapping("/heartbeat")
    public R heartbeat(@Validated @RequestBody ControlServerHeartbeatDto dto,
                       @RequestHeader(value = "X-Agent-Token", required = false) String token) {
        return controlServerService.heartbeat(dto, token);
    }

    private String resolveMasterUrl(HttpServletRequest request) {
        String proto = firstHeader(request, "X-Forwarded-Proto");
        String host = firstHeader(request, "X-Forwarded-Host");
        if (host == null || host.trim().isEmpty()) {
            host = request.getHeader("Host");
        }
        if (proto == null || proto.trim().isEmpty()) {
            proto = request.getScheme();
        }
        if (host == null || host.trim().isEmpty()) {
            return null;
        }
        return proto + "://" + host;
    }

    private String firstHeader(HttpServletRequest request, String name) {
        String value = request.getHeader(name);
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        int comma = value.indexOf(',');
        return (comma >= 0 ? value.substring(0, comma) : value).trim();
    }
}
