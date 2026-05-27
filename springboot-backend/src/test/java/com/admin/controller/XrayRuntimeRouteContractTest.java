package com.admin.controller;

import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class XrayRuntimeRouteContractTest {

    @Test
    void exposesProductRuntimeBaseRoute() {
        RequestMapping mapping = XrayPanelController.class.getAnnotation(RequestMapping.class);

        assertEquals(Set.of("/api/v1/runtimes/xray"), Set.of(mapping.value()));
        String legacyBase = "/api/v1/" + "xray" + "-panel";
        assertFalse(Arrays.asList(mapping.value()).contains(legacyBase));
    }

    @Test
    void exposesExpectedPostRoutes() {
        Set<String> routes = Arrays.stream(XrayPanelController.class.getDeclaredMethods())
                .flatMap(this::postMappingValues)
                .collect(Collectors.toSet());

        Set<String> expected = Set.of(
                "/test",
                "/inbounds/list",
                "/inbounds/add",
                "/inbounds/update",
                "/inbounds/delete",
                "/inbounds/set-enable",
                "/clients/add",
                "/clients/update",
                "/clients/delete",
                "/clients/reset-traffic",
                "/config",
                "/outbounds",
                "/outbounds/traffic",
                "/traffic/sync",
                "/traffic/list",
                "/outbounds/save",
                "/restart-xray"
        );

        assertTrue(routes.containsAll(expected), "missing routes: " + missing(expected, routes));
        String legacySegment = "xray" + "-panel";
        assertFalse(routes.stream().anyMatch(route -> route.contains(legacySegment)));
    }

    private Stream<String> postMappingValues(Method method) {
        PostMapping mapping = method.getAnnotation(PostMapping.class);
        if (mapping == null) {
            return Stream.empty();
        }
        String[] values = mapping.value().length > 0 ? mapping.value() : mapping.path();
        return Arrays.stream(values);
    }

    private Set<String> missing(Set<String> expected, Set<String> actual) {
        return expected.stream()
                .filter(route -> !actual.contains(route))
                .collect(Collectors.toSet());
    }
}
