package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.ChatMessageDTO;
import com.handcraft.platform.modules.vo.*;
/** 需求和订单关系限定的图文沟通业务入口。 */
public interface ConversationService {
    /** 从需求和登录身份推导双方，创建唯一会话或返回已有会话。 */
    Creation create(Long userId,Long requestId);
    /** 查询本人参与的最近会话。 */
    PageVO<ConversationVO> list(Long userId,int page,int size);
    /** 只返回本人关联会话详情，不以身份切换代替归属校验。 */
    ConversationVO detail(Long userId,Long id);
    /** 查询本人未读消息总量，不写已读状态。 */
    long unread(Long userId);
    /** 按排他方向游标补拉，初次读取最近五十条并按升序展示。 */
    ChatMessagePageVO messages(Long userId,Long id,Long before,Long after,int size);
    /** 幂等保存消息，串行分配序号；超限冷却持久化后返回429。 */
    Sent send(Long userId,Long id,ChatMessageDTO input);
    /** 已读游标只前进且不超过已有消息，提交后同步多端。 */
    ConversationVO read(Long userId,Long id,Long seq);
    /** @param conversation 会话视图 @param created 是否首次创建 */
    record Creation(ConversationVO conversation,boolean created) {}
    /** @param message 消息视图 @param created 是否首次发送 */
    record Sent(ChatMessageVO message,boolean created) {}
}
