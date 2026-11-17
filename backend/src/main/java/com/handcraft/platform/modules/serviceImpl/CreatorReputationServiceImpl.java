package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.mapper.CreatorReputationMapper;
import com.handcraft.platform.modules.service.CreatorReputationService;
import com.handcraft.platform.modules.vo.CreatorReputationVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** 公开展示和报价排序共用统计，不据评分改变业务资格。 */
@Service
public class CreatorReputationServiceImpl implements CreatorReputationService {
    private static final Logger LOGGER = LoggerFactory.getLogger(CreatorReputationServiceImpl.class);
    private final CreatorReputationMapper reputations;

    public CreatorReputationServiceImpl(CreatorReputationMapper reputations) { this.reputations = reputations; }

    @Override
    public CreatorReputationVO summary(Long creatorId) {
        return BusinessLog.run(LOGGER, "创作者公开口碑查询", creatorId, () -> reputations.summary(creatorId));
    }
}
