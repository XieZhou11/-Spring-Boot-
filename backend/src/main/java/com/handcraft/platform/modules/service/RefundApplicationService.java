package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.vo.*;
import java.time.LocalDateTime;
/** 普通售后仅处理申请、双方不可变补证及买家撤回。 */
public interface RefundApplicationService {
    /** 买家创建或按完整原输入重试普通申请。 */ Creation create(Long actor,Long orderId,RefundApplicationDTO input);
    /** 双方读取单个申请及最新操作资格。 */ RefundApplicationVO detail(Long actor,Long id);
    /** 双方分页读取本单全部申请；请求键只精确检索当前买家原创建。 */ PageVO<RefundApplicationVO> list(Long actor,Long orderId,int page,int size,String requestKey);
    /** 双方追加补证或核验原提交重试。 */ Creation supplement(Long actor,Long id,RefundEvidenceDTO input);
    /** 双方读取排他游标补证或提交者本人原请求键。 */ RefundEvidencePageVO evidence(Long actor,Long id,long afterId,int size,String requestKey);
    /** 买家自然幂等撤回并恢复原履约状态。 */ void withdraw(Long actor,Long id);
    /** 调用方持有上游锁，在当前事务恢复原状态并仅顺延本次暂停占用的自动收货时长。 */ void restore(TradeOrder order,RefundApplication refund,LocalDateTime now);
    /** 已由调用方完成身份校验时，映射只读快照；不改变状态和已读游标。 */ RefundApplicationVO view(RefundApplication refund,TradeOrder order,Long actor);
    /** 是否在普通售后合法原状态及完成后原七天窗口内。 */ boolean eligible(TradeOrder order,LocalDateTime now);
    /** @param id 申请编号 @param created 本次是否新建 */ record Creation(Long id,boolean created) {}
}
