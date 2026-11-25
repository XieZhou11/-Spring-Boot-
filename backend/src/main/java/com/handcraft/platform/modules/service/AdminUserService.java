package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.AdminBusinessPauseDTO;
import com.handcraft.platform.modules.dto.AdminUserQueryDTO;
import com.handcraft.platform.modules.dto.CreatorPauseDTO;
import com.handcraft.platform.modules.vo.AdminUserBusinessVO;
import com.handcraft.platform.modules.vo.AdminUserDetailVO;
import com.handcraft.platform.modules.vo.PageVO;

/** 管理员账号检索与分别管理两种新业务暂停状态。 */
public interface AdminUserService {
    /** 按邮箱、昵称及认证状态分页查询非管理员账号。 */ PageVO<java.util.Map<String,Object>> list(Long admin,AdminUserQueryDTO query);
    /** 查看账号基础状态及最近关联作品、需求、订单。 */ AdminUserDetailVO detail(Long admin,Long userId);
    /** 管理员统一暂停或人工恢复账号新业务并记录原因。 */ AdminUserBusinessVO setBusinessPause(Long admin,Long userId,AdminBusinessPauseDTO input);
    /** 举报触发的账号处置关联举报编号。 */ AdminUserBusinessVO setBusinessPause(Long admin,Long userId,AdminBusinessPauseDTO input,Long reportId);
    /** 创作者本人暂停或恢复接单，不改变后台暂停状态。 */ AdminUserBusinessVO setCreatorPause(Long userId,CreatorPauseDTO input);
    /** 读取本人两个互不覆盖的新业务暂停状态。 */ AdminUserBusinessVO creatorState(Long userId);
}
