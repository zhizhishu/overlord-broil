package com.admin.service;

import com.admin.common.dto.XrayPanelInboundDto;
import com.admin.common.dto.XrayPanelServerDto;
import com.admin.common.dto.XrayPanelTrafficQueryDto;
import com.admin.common.dto.XrayPanelXraySettingDto;
import com.admin.common.lang.R;

public interface XrayPanelService {

    R testConnection(XrayPanelServerDto dto);

    R listInbounds(XrayPanelServerDto dto);

    R addInbound(XrayPanelInboundDto dto);

    R updateInbound(XrayPanelInboundDto dto);

    R deleteInbound(XrayPanelInboundDto dto);

    R setInboundEnable(XrayPanelInboundDto dto);

    R addClient(XrayPanelInboundDto dto);

    R updateClient(XrayPanelInboundDto dto);

    R deleteClient(XrayPanelInboundDto dto);

    R resetClientTraffic(XrayPanelInboundDto dto);

    R getConfig(XrayPanelServerDto dto);

    R getOutbounds(XrayPanelServerDto dto);

    R getOutboundsTraffic(XrayPanelServerDto dto);

    R syncTraffic(XrayPanelServerDto dto);

    R listTrafficSnapshots(XrayPanelTrafficQueryDto dto);

    R saveXraySetting(XrayPanelXraySettingDto dto);

    R restartXray(XrayPanelServerDto dto);
}
