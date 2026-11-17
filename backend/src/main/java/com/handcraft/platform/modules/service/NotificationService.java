package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.*;

/** 持久化通知与已读状态，实时推送不替代数据库记录。 */
public interface NotificationService {
    /** 报价与订单事件按业务对象去重，与业务同事务保存，提交后推送。 */
    void tradeChanged(Long recipientId,String eventType,String businessType,Long businessId,Long requestId);
    /** 与需求状态事务一起保存按事件和接收人去重的邀约、关闭或过期通知。 */
    void customRequestChanged(Long recipientId,Long requestId,String eventType);
    /** 审核事务内保存唯一事件，事务提交后才推送。 */
    void creatorReviewed(Long recipientId,Long applicationId,String decision,String reason);
    /** 作品审核或管理员下架通知，事件按作品及提交版本去重并在提交后推送。 */
    void workChanged(Long recipientId,Long workId,Long submittedVersion,String eventType,String decision,String reason);
    /** 读取本人通知分页，最新优先。 */
    PageVO<NotificationVO> list(Long userId,int page,int size);
    /** 查询本人未读总数。 */
    long unread(Long userId);
    /** 只能标记本人通知，重复请求保持原已读时间。 */
    NotificationVO read(Long userId,Long id);
}
