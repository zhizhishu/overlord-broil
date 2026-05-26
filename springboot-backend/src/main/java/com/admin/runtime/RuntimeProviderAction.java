package com.admin.runtime;

import lombok.Data;

@Data
public class RuntimeProviderAction {

    private String key;

    private String label;

    private String category;

    private String protocol;

    private String providerKey;

    private boolean danger;

    private boolean primary;

    private boolean stateSync;
}
