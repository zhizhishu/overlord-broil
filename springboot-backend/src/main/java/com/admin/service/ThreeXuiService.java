package com.admin.service;

import com.admin.common.dto.ThreeXuiInboundDto;
import com.admin.common.dto.ThreeXuiServerDto;
import com.admin.common.dto.ThreeXuiTrafficQueryDto;
import com.admin.common.dto.ThreeXuiXraySettingDto;
import com.admin.common.lang.R;

public interface ThreeXuiService {

    R testConnection(ThreeXuiServerDto dto);

    R listInbounds(ThreeXuiServerDto dto);

    R addInbound(ThreeXuiInboundDto dto);

    R updateInbound(ThreeXuiInboundDto dto);

    R deleteInbound(ThreeXuiInboundDto dto);

    R setInboundEnable(ThreeXuiInboundDto dto);

    R addClient(ThreeXuiInboundDto dto);

    R updateClient(ThreeXuiInboundDto dto);

    R deleteClient(ThreeXuiInboundDto dto);

    R resetClientTraffic(ThreeXuiInboundDto dto);

    R getConfig(ThreeXuiServerDto dto);

    R getOutbounds(ThreeXuiServerDto dto);

    R getOutboundsTraffic(ThreeXuiServerDto dto);

    R syncTraffic(ThreeXuiServerDto dto);

    R listTrafficSnapshots(ThreeXuiTrafficQueryDto dto);

    R saveXraySetting(ThreeXuiXraySettingDto dto);

    R restartXray(ThreeXuiServerDto dto);
}
