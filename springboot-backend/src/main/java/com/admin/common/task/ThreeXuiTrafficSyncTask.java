package com.admin.common.task;

import com.admin.common.dto.ThreeXuiServerDto;
import com.admin.entity.ControlServer;
import com.admin.service.ControlServerService;
import com.admin.service.ThreeXuiService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.List;

@Slf4j
@Component
public class ThreeXuiTrafficSyncTask {

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private ThreeXuiService threeXuiService;

    @Scheduled(cron = "0 */5 * * * ?")
    public void syncRemoteTraffic() {
        QueryWrapper<ControlServer> query = new QueryWrapper<>();
        query.eq("status", 1)
                .isNotNull("xui_endpoint")
                .ne("xui_endpoint", "")
                .isNotNull("xui_api_token")
                .ne("xui_api_token", "");

        List<ControlServer> servers = controlServerService.list(query);
        for (ControlServer server : servers) {
            try {
                ThreeXuiServerDto dto = new ThreeXuiServerDto();
                dto.setServerId(server.getId());
                threeXuiService.syncTraffic(dto);
            } catch (Exception e) {
                log.warn("3x-ui traffic sync failed, serverId={}", server.getId(), e);
            }
        }
    }
}
