package com.admin.service;

import com.admin.common.dto.XrayRuntimeInboundDto;
import com.admin.common.dto.XrayRuntimeServerDto;
import com.admin.common.dto.XrayRuntimeTrafficQueryDto;
import com.admin.common.dto.XrayRuntimeXraySettingDto;
import com.admin.common.lang.R;

public interface XrayRuntimeService {

    R testConnection(XrayRuntimeServerDto dto);

    R listInbounds(XrayRuntimeServerDto dto);

    R addInbound(XrayRuntimeInboundDto dto);

    R updateInbound(XrayRuntimeInboundDto dto);

    R deleteInbound(XrayRuntimeInboundDto dto);

    R setInboundEnable(XrayRuntimeInboundDto dto);

    R addClient(XrayRuntimeInboundDto dto);

    R updateClient(XrayRuntimeInboundDto dto);

    R deleteClient(XrayRuntimeInboundDto dto);

    R resetClientTraffic(XrayRuntimeInboundDto dto);

    R getConfig(XrayRuntimeServerDto dto);

    R getOutbounds(XrayRuntimeServerDto dto);

    R getOutboundsTraffic(XrayRuntimeServerDto dto);

    R syncTraffic(XrayRuntimeServerDto dto);

    R listTrafficSnapshots(XrayRuntimeTrafficQueryDto dto);

    R saveXraySetting(XrayRuntimeXraySettingDto dto);

    R restartXray(XrayRuntimeServerDto dto);
}
