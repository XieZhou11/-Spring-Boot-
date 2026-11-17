package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.QuoteCreateDTO;
import com.handcraft.platform.modules.dto.QuoteQueryDTO;
import com.handcraft.platform.modules.vo.*;

/** 报价提交、撤回及按真实关系读取，界面身份不授予额外权限。 */
public interface QuoteService {
    /** 提交独立报价，原请求重试返回原记录。 */
    Creation create(Long userId,Long requestId,QuoteCreateDTO input);
    /** 读取本人或需求所属买家可见的报价历史。 */
    PageVO<QuoteVO> list(Long userId,Long requestId,QuoteQueryDTO query);
    /** 读取报价详情，其他投标者不可见。 */
    QuoteVO detail(Long userId,Long quoteId);
    /** 撤回有效报价并同步需求状态。 */
    QuoteVO withdraw(Long userId,Long quoteId);
    /** 仅买家比较有效报价。 */
    QuoteComparisonVO comparison(Long userId,Long requestId,String sort);
    /** 查询本人自然日提交额度。 */
    QuoteQuotaVO quota(Long userId);
    /** 解释当前账号不能提交需求报价的具体业务原因。 */
    String submissionReason(Long userId,Long requestId);
    /** @param quote 报价结果 @param created 是否首次创建 */
    record Creation(QuoteVO quote,boolean created) {}
}
