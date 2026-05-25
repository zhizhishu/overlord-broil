package com.admin.entity;

import com.admin.runtime.RuntimeProviderAssignment;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class DeployTask extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private Long serverId;

    private String serverName;

    private String protocol;

    private String action;

    private String state;

    private String requestJson;

    private String script;

    private String resultJson;

    private Long startedTime;

    private Long finishedTime;

    @TableField(exist = false)
    private RuntimeProviderAssignment runtimeProvider;
}
