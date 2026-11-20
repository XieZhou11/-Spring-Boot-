package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.vo.*;
/** 与参与方服务分离的管理员只读查证和原子裁定。 */
public interface AdminRefundService {
    /** 查询管理员售后处理队列。 */ PageVO<AdminRefundQueueVO> list(Long admin,AdminRefundQueryDTO query);
    /** 获取一致的只读订单、资金和履约查证快照。 */ AdminRefundDetailVO detail(Long admin,Long id);
    /** 按排他游标读取不可变补证。 */ RefundEvidencePageVO evidence(Long admin,Long id,Long cursor,int size);
    /** 查阅原订单会话，不推进交易双方已读游标。 */ ChatMessagePageVO messages(Long admin,Long id,Long before,Long after,int size);
    /** 按当前申请关联订单的实际历史引用签发短期私图地址。 */ ImageVO image(Long admin,Long id,Long fileId);
    /** 校验补证版本、终局重试及退回事实，原子批准全额退款或驳回恢复。 */ void decide(Long admin,Long id,AdminRefundDecisionDTO input);
}
