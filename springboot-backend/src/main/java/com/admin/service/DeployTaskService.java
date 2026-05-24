package com.admin.service;

import com.admin.common.dto.AgentTaskClaimDto;
import com.admin.common.dto.AgentTaskReportDto;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeployTaskStateDto;
import com.admin.common.dto.OrchestrationPlanDto;
import com.admin.common.lang.R;
import com.admin.entity.DeployTask;
import com.baomidou.mybatisplus.extension.service.IService;

public interface DeployTaskService extends IService<DeployTask> {

    R createTask(DeployTaskDto dto);

    R createOrchestrationTask(OrchestrationPlanDto dto);

    R getAllTasks();

    R getTaskScript(Long id);

    R updateTaskState(DeployTaskStateDto dto);

    R retryTask(Long id);

    R claimAgentTask(AgentTaskClaimDto dto, String token);

    R reportAgentTask(AgentTaskReportDto dto, String token);

    R deleteTask(Long id);
}
