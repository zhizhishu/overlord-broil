package com.admin.runtime;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class RuntimeProviderDescriptor {

    private String key;

    private String name;

    private String runtimeType;

    private String executor;

    private String stateSource;

    private String summary;

    private boolean agentRequired;

    private boolean masterApiSupported;

    private boolean nanoSupported;

    private List<String> protocols = new ArrayList<>();

    private List<String> actions = new ArrayList<>();

    private List<RuntimeProviderAction> actionCatalog = new ArrayList<>();

    private List<String> capabilities = new ArrayList<>();

    private List<String> requiredServerFields = new ArrayList<>();

    private List<String> exposedPorts = new ArrayList<>();

    private List<String> relatedProviders = new ArrayList<>();
}
