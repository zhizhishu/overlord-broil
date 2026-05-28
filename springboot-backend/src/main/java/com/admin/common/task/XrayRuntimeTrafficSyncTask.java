package com.admin.common.task;

import com.admin.common.dto.XrayRuntimeServerDto;
import com.admin.entity.ControlServer;
import com.admin.service.ControlServerService;
import com.admin.service.XrayRuntimeService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.List;

@Slf4j
@Component
public class XrayRuntimeTrafficSyncTask {

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private XrayRuntimeService xrayRuntimeService;

    @Scheduled(cron = "0 */5 * * * ?")
    public void syncRemoteTraffic() {
        QueryWrapper<ControlServer> query = new QueryWrapper<>();
        query.eq("status", 1)
                .isNotNull("xray_runtime_endpoint")
                .ne("xray_runtime_endpoint", "")
                .isNotNull("xray_runtime_api_token")
                .ne("xray_runtime_api_token", "");

        List<ControlServer> servers = controlServerService.list(query);
        for (ControlServer server : servers) {
            try {
                XrayRuntimeServerDto dto = new XrayRuntimeServerDto();
                dto.setServerId(server.getId());
                xrayRuntimeService.syncTraffic(dto);
            } catch (Exception e) {
                log.warn("Node service traffic sync failed, serverId={}", server.getId(), e);
            }
        }
    }
}
