package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.entity.CustomRequest;
import com.handcraft.platform.modules.entity.Quote;
import java.util.List;

/** 调用方先持有需求行锁，共用报价、需求和归档的事务规则。 */
public interface QuoteLifecycleService {
    /** 失效到期报价并重算开放需求状态，返回锁定的报价历史。 */
    List<Quote> reconcile(CustomRequest request);
    /** 关闭或过期需求，同步失效报价及归档无订单会话。 */
    void terminate(CustomRequest request,String status,Long actorId);
    /** 在需求行锁内保存状态及版本，保留内容。 */
    void state(CustomRequest request,String status,Long actorId);
    /** 在同一事务内转换有效报价并记录时间与通知。 */
    void invalidate(CustomRequest request,Quote quote,String reason,Long actorId);
}
