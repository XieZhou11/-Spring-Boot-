package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.ProfileUpdateDTO;
import com.handcraft.platform.modules.vo.ProfileVO;

/** 本人资料业务接口，userId 只能由服务端认证主体提供。 */
public interface PersonalProfileService {
    /** 读取本人资料及当前可用的头像短时访问地址。 */
    ProfileVO get(Long userId);
    /** 保存昵称和简介，不改变邮箱、密码、资格或登录截止时间。 */
    ProfileVO update(Long userId, ProfileUpdateDTO input);
}
