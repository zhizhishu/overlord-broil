package com.admin.service;

import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.ProtocolNodeDto;
import com.admin.common.dto.ProtocolNodeQueryDto;
import com.admin.common.lang.R;
import com.admin.entity.DeployTask;
import com.admin.entity.ProtocolNode;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ProtocolNodeService extends IService<ProtocolNode> {

    R createNode(ProtocolNodeDto dto);

    R updateNode(ProtocolNodeDto dto);

    R listNodes(ProtocolNodeQueryDto dto);

    R deleteNode(ProtocolNodeDto dto);

    R restartNode(ProtocolNodeDto dto);

    R syncNodes(ProtocolNodeQueryDto dto);

    void applyAgentResultNodes(DeployTask task, JSONObject result);
}
