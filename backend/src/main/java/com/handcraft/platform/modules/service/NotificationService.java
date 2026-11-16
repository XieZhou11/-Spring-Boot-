package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.*;

/** 持久化通知与已读状态，实时推送不替代数据库记录。 */
public interface NotificationService {
    /** 审核事务内保存唯一事件，事务提交后才推送。 */
    void creatorReviewed(Long recipientId,Long applicationId,String decision,String reason);
    /** 读取本人通知分页，最新优先。 */
    PageVO<NotificationVO> list(Long userId,int page,int size);
    /** 查询本人未读总数。 */
    long unread(Long userId);
    /** 只能标记本人通知，重复请求保持原已读时间。 */
    NotificationVO read(Long userId,Long id);
}
