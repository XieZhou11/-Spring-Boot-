package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.CreatorReputationVO;

/** 创作者主页和报价对比复用同一公开口碑口径。 */
public interface CreatorReputationService {
    /** 汇总可见且未退款的有效评价，以及仍未退款的实际完成订单。 */
    CreatorReputationVO summary(Long creatorId);
}
