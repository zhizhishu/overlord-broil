package com.admin.service;

import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.ServerForwardRuleDto;
import com.admin.common.dto.ServerForwardRuleQueryDto;
import com.admin.common.lang.R;
import com.admin.entity.DeployTask;
import com.admin.entity.ServerForwardRule;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ServerForwardRuleService extends IService<ServerForwardRule> {

    R createRule(ServerForwardRuleDto dto);

    R updateRule(ServerForwardRuleDto dto);

    R listRules(ServerForwardRuleQueryDto dto);

    R deleteRule(ServerForwardRuleDto dto);

    R restartRule(ServerForwardRuleDto dto);

    void applyAgentResultForwardRules(DeployTask task, JSONObject result);
}
