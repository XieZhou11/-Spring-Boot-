package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.entity.TradeOrder;
import com.handcraft.platform.modules.vo.*;
import java.math.BigDecimal;

/** 持久化通知与已读状态，实时推送不替代数据库记录。 */
public interface NotificationService {
    /** 售后申请、证据和处理结果与业务同事务保存，按事件编号去重。 */
    void refundChanged(Long recipientId,String eventType,Long eventId,Long orderId,Long requestId);
    /** 履约按原始记录或操作编号去重，事件键与订单跳转编号独立。 */
    void fulfillmentChanged(Long recipientId,String eventType,Long eventId,Long orderId,Long requestId);
    /** 在结算或退款事务内保存双方的结算结果通知，金额仅在创作者正文展示。 */
    void settlementChanged(TradeOrder order, String eventType, Long eventId, BigDecimal amount);
    /** 报价与订单事件按业务对象去重，与业务同事务保存，提交后推送。 */
    void tradeChanged(Long recipientId,String eventType,String businessType,Long businessId,Long requestId);
    /** 与需求状态事务一起保存按事件和接收人去重的邀约、关闭或过期通知。 */
    void customRequestChanged(Long recipientId,Long requestId,String eventType);
    /** 审核事务内保存唯一事件，事务提交后才推送。 */
    void creatorReviewed(Long recipientId,Long applicationId,String decision,String reason);
    /** 作品审核或管理员下架通知，事件按作品及提交版本去重并在提交后推送。 */
    void workChanged(Long recipientId,Long workId,Long submittedVersion,String eventType,String decision,String reason);
    /** 下架以状态版本标识本次事件，举报触发时携带关联举报。 */
    void workChanged(Long recipientId,Long workId,Long submittedVersion,String eventType,String decision,String reason,Long stateVersion,Long reportId);
    /** 举报处置及更正通知，使用本次操作日志编号去重。 */
    void reportDecided(Long recipientId,Long reportId,Long eventId,boolean review,String title,String content);
    /** 账号统一暂停新业务或人工恢复通知，仅在状态实际变化时产生。 */
    void accountBusinessChanged(Long recipientId,boolean paused,String reason);
    /** 举报触发的暂停或恢复通知，直接关联该举报。 */
    void accountBusinessChanged(Long recipientId,boolean paused,String reason,Long reportId);
    /** 读取本人通知分页，最新优先。 */
    PageVO<NotificationVO> list(Long userId,int page,int size);
    /** 查询本人未读总数。 */
    long unread(Long userId);
    /** 只能标记本人通知，重复请求保持原已读时间。 */
    NotificationVO read(Long userId,Long id);
}
