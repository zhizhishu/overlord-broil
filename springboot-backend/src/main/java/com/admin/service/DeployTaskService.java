package com.admin.service;

import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeployTaskStateDto;
import com.admin.common.lang.R;
import com.admin.entity.DeployTask;
import com.baomidou.mybatisplus.extension.service.IService;

public interface DeployTaskService extends IService<DeployTask> {

    R createTask(DeployTaskDto dto);

    R getAllTasks();

    R getTaskScript(Long id);

    R updateTaskState(DeployTaskStateDto dto);

    R deleteTask(Long id);
}
