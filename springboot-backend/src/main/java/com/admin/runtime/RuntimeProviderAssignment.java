package com.admin.runtime;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class RuntimeProviderAssignment {

    private String key;

    private String name;

    private String protocol;

    private String action;

    private String executor;

    private String stateSource;

    private boolean agentRequired;

    private boolean masterApiSupported;

    private boolean nanoSupported;

    private List<String> capabilities = new ArrayList<>();

    private List<String> relatedProviders = new ArrayList<>();
}
