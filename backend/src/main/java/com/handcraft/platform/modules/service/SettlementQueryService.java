package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.AdminSettlementQueryDTO;
import com.handcraft.platform.modules.dto.SettlementQueryDTO;
import com.handcraft.platform.modules.vo.AdminSettlementVO;
import com.handcraft.platform.modules.vo.CreatorSettlementVO;
import com.handcraft.platform.modules.vo.PageVO;

/** 结算记录只读查询：创作者收入记录与管理员资金记录，均不暴露他人数据。 */
public interface SettlementQueryService {
    /** 本人作为创作者的收入记录，账户仅脱敏文本。 */
    PageVO<CreatorSettlementVO> mine(Long actor,SettlementQueryDTO query);
    /** 管理员资金记录，含已审核收款快照的姓名与账号明文。 */
    PageVO<AdminSettlementVO> admin(Long actor,AdminSettlementQueryDTO query);
}
