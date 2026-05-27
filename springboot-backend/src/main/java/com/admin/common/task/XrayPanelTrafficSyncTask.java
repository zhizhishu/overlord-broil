package com.admin.common.task;

import com.admin.common.dto.XrayPanelServerDto;
import com.admin.entity.ControlServer;
import com.admin.service.ControlServerService;
import com.admin.service.XrayPanelService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.List;

@Slf4j
@Component
public class XrayPanelTrafficSyncTask {

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private XrayPanelService xrayPanelService;

    @Scheduled(cron = "0 */5 * * * ?")
    public void syncRemoteTraffic() {
        QueryWrapper<ControlServer> query = new QueryWrapper<>();
        query.eq("status", 1)
                .isNotNull("xray_panel_endpoint")
                .ne("xray_panel_endpoint", "")
                .isNotNull("xray_panel_api_token")
                .ne("xray_panel_api_token", "");

        List<ControlServer> servers = controlServerService.list(query);
        for (ControlServer server : servers) {
            try {
                XrayPanelServerDto dto = new XrayPanelServerDto();
                dto.setServerId(server.getId());
                xrayPanelService.syncTraffic(dto);
            } catch (Exception e) {
                log.warn("Xray Runtime traffic sync failed, serverId={}", server.getId(), e);
            }
        }
    }
}
