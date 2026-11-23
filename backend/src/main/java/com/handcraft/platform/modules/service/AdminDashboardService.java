package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.AdminDashboardQueryDTO;
import com.handcraft.platform.modules.vo.AdminDashboardVO;

/** 按需求口径读取后台基础数据与待办数量。 */
public interface AdminDashboardService {
    /** 当前指标使用实时聚合，新增账号和认证按可选北京时间区间统计。 */ AdminDashboardVO dashboard(Long admin,AdminDashboardQueryDTO query);
}
