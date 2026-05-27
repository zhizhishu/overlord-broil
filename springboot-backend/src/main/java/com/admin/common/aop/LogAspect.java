package com.admin.common.aop;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.admin.common.utils.HttpContextUtils;
import com.admin.common.utils.IpUtils;
import com.admin.common.utils.JwtUtil;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.CodeSignature;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.lang.reflect.Method;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@Aspect
@Slf4j
public class LogAspect {

    private static final String MASK = "******";

    @Pointcut("@annotation(com.admin.common.aop.LogAnnotation)")
    public void pt() {
    }

    @AfterReturning(value = "pt()", returning = "returnValue")
    public void log(JoinPoint joinPoint, Object returnValue) {
        try {
            HttpServletRequest request = HttpContextUtils.getHttpServletRequest();
            String controllerMethod = controllerMethod(joinPoint);
            log.info("request log userId=[{}], ip=[{}], method=[{}], handler=[{}], request=[{}], response=[{}]",
                    userId(request),
                    IpUtils.getIpAddr(request),
                    request == null ? "" : request.getMethod(),
                    controllerMethod,
                    safeJson(requestParams(joinPoint)),
                    safeJson(returnValue));
        } catch (Exception e) {
            log.warn("request log failed: {}", e.getMessage());
        }
    }

    @AfterThrowing(value = "pt()", throwing = "ex")
    public void recordLog(JoinPoint joinPoint, Exception ex) {
        try {
            HttpServletRequest request = HttpContextUtils.getHttpServletRequest();
            log.warn("exception log userId=[{}], ip=[{}], method=[{}], handler=[{}], request=[{}], error=[{}]",
                    userId(request),
                    IpUtils.getIpAddr(request),
                    request == null ? "" : request.getMethod(),
                    controllerMethod(joinPoint),
                    safeJson(requestParams(joinPoint)),
                    ex == null ? "unknown" : ex.getMessage(),
                    ex);
        } catch (Exception e) {
            log.warn("exception log failed: {}", e.getMessage());
        }
    }

    private String userId(HttpServletRequest request) {
        if (request == null) {
            return "anonymous";
        }
        String authorization = request.getHeader("Authorization");
        if (authorization == null || authorization.trim().isEmpty()) {
            return "anonymous";
        }
        try {
            return String.valueOf(JwtUtil.getUserIdFromToken(authorization));
        } catch (Exception ignored) {
            return "anonymous";
        }
    }

    private String controllerMethod(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        return joinPoint.getTarget().getClass().getName() + "." + method.getName();
    }

    private Object requestParams(JoinPoint joinPoint) {
        Object[] args = joinPoint.getArgs();
        String[] names = ((CodeSignature) joinPoint.getSignature()).getParameterNames();
        if (args == null || args.length == 0) {
            return new LinkedHashMap<>();
        }
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < args.length; i++) {
            Object arg = args[i];
            if (arg instanceof HttpServletRequest || arg instanceof HttpServletResponse) {
                continue;
            }
            String name = names != null && i < names.length ? names[i] : "arg" + i;
            map.put(name, arg);
        }
        return map;
    }

    private String safeJson(Object value) {
        try {
            return JSON.toJSONString(maskSensitive(JSON.parse(JSON.toJSONString(value))));
        } catch (Exception ignored) {
            return String.valueOf(value);
        }
    }

    private Object maskSensitive(Object value) {
        if (value instanceof JSONObject) {
            JSONObject source = (JSONObject) value;
            JSONObject copy = new JSONObject(true);
            for (String key : source.keySet()) {
                copy.put(key, isSensitiveKey(key) ? MASK : maskSensitive(source.get(key)));
            }
            return copy;
        }
        if (value instanceof JSONArray) {
            JSONArray source = (JSONArray) value;
            JSONArray copy = new JSONArray();
            for (Object item : source) {
                copy.add(maskSensitive(item));
            }
            return copy;
        }
        if (value instanceof Map<?, ?>) {
            Map<?, ?> source = (Map<?, ?>) value;
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : source.entrySet()) {
                String key = String.valueOf(entry.getKey());
                copy.put(key, isSensitiveKey(key) ? MASK : maskSensitive(entry.getValue()));
            }
            return copy;
        }
        if (value instanceof Collection<?>) {
            JSONArray copy = new JSONArray();
            for (Object item : (Collection<?>) value) {
                copy.add(maskSensitive(item));
            }
            return copy;
        }
        return value;
    }

    private boolean isSensitiveKey(String key) {
        if (key == null) {
            return false;
        }
        String normalized = key.toLowerCase();
        return normalized.contains("password")
                || normalized.contains("token")
                || normalized.contains("secret")
                || normalized.contains("psk")
                || normalized.contains("privatekey")
                || normalized.contains("twofactor")
                || normalized.contains("authorization")
                || normalized.equals("data")
                || normalized.equals("script")
                || normalized.equals("stdout")
                || normalized.equals("stderr");
    }
}
