package com.admin.service;

import com.admin.common.dto.ProtocolProfileDto;
import com.admin.common.dto.ProtocolProfileUpdateDto;
import com.admin.common.lang.R;
import com.admin.entity.ProtocolProfile;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ProtocolProfileService extends IService<ProtocolProfile> {

    R createProfile(ProtocolProfileDto dto);

    R getAllProfiles();

    R updateProfile(ProtocolProfileUpdateDto dto);

    R deleteProfile(Long id);

    R ensureDefaultProfiles();
}
