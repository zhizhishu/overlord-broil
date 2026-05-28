package com.admin.service.impl;

import com.admin.common.dto.ProtocolProfileDto;
import com.admin.common.dto.ProtocolProfileUpdateDto;
import com.admin.common.lang.R;
import com.admin.entity.ProtocolProfile;
import com.admin.mapper.ProtocolProfileMapper;
import com.admin.service.ProtocolProfileService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ProtocolProfileServiceImpl extends ServiceImpl<ProtocolProfileMapper, ProtocolProfile> implements ProtocolProfileService {

    private static final int STATUS_ACTIVE = 1;

    @Override
    public R createProfile(ProtocolProfileDto dto) {
        long now = System.currentTimeMillis();
        ProtocolProfile profile = new ProtocolProfile();
        BeanUtils.copyProperties(dto, profile);
        profile.setStatus(STATUS_ACTIVE);
        profile.setCreatedTime(now);
        profile.setUpdatedTime(now);

        return this.save(profile) ? R.ok(profile) : R.err("protocol profile create failed");
    }

    @Override
    public R getAllProfiles() {
        ensureDefaultProfiles();
        return R.ok(this.list());
    }

    @Override
    public R updateProfile(ProtocolProfileUpdateDto dto) {
        if (this.getById(dto.getId()) == null) {
            return R.err("protocol profile not found");
        }

        ProtocolProfile profile = new ProtocolProfile();
        BeanUtils.copyProperties(dto, profile);
        profile.setUpdatedTime(System.currentTimeMillis());

        return this.updateById(profile) ? R.ok("protocol profile updated") : R.err("protocol profile update failed");
    }

    @Override
    public R deleteProfile(Long id) {
        if (this.getById(id) == null) {
            return R.err("protocol profile not found");
        }
        return this.removeById(id) ? R.ok("protocol profile deleted") : R.err("protocol profile delete failed");
    }

    @Override
    public R ensureDefaultProfiles() {
        if (this.count() > 0) {
            return R.ok();
        }

        long now = System.currentTimeMillis();
        List<ProtocolProfile> defaults = new ArrayList<>();
        defaults.add(defaultProfile("Snell v4", "snell", "v4", 8388, "tcp", "Non-interactive Snell server install", "{\"dns\":{\"mode\":\"system\"},\"firewall\":{\"enabled\":false}}", now));
        defaults.add(defaultProfile("VLESS Reality", "vless", "xray", 443, "tcp", "VLESS Reality inbound profile for compatible agents", "{\"security\":\"reality\",\"network\":\"tcp\"}", now));
        defaults.add(defaultProfile("VMess WS", "vmess", "xray", 2086, "ws", "VMess websocket inbound profile", "{\"network\":\"ws\",\"path\":\"/ws\"}", now));
        defaults.add(defaultProfile("Trojan TCP", "trojan", "xray", 443, "tcp", "Trojan TCP inbound profile", "{\"network\":\"tcp\",\"security\":\"tls\"}", now));
        defaults.add(defaultProfile("Shadowsocks", "shadowsocks", "xray", 8388, "tcp", "Shadowsocks inbound profile", "{\"method\":\"2022-blake3-aes-128-gcm\"}", now));

        return this.saveBatch(defaults) ? R.ok(defaults) : R.err("default protocol profiles seed failed");
    }

    private ProtocolProfile defaultProfile(String name, String protocol, String versionFamily, Integer listenPort, String transport, String remark, String configJson, long now) {
        ProtocolProfile profile = new ProtocolProfile();
        profile.setName(name);
        profile.setProtocol(protocol);
        profile.setVersionFamily(versionFamily);
        profile.setListenPort(listenPort);
        profile.setTransport(transport);
        profile.setRemark(remark);
        profile.setConfigJson(configJson);
        profile.setStatus(STATUS_ACTIVE);
        profile.setCreatedTime(now);
        profile.setUpdatedTime(now);
        return profile;
    }
}
