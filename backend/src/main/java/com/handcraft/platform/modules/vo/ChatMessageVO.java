package com.handcraft.platform.modules.vo;
import java.util.List;
import java.time.*;
/**
 * @param id 消息编号
 * @param conversationId 会话编号
 * @param seqNo 会话内序号
 * @param senderId 发送人编号
 * @param clientMessageKey 客户端幂等键
 * @param content 可空文字
 * @param imageIds 图片编号
 * @param createdAt 服务器保存时间
 * @param referencedNodeId 选填本会话订单的制作节点编号
 * @param referencedNodeCode 选填制作节点标识，供会话展示引用来源
 */
public record ChatMessageVO(String id,String conversationId,String seqNo,String senderId,String clientMessageKey,String content,List<String> imageIds,OffsetDateTime createdAt,String referencedNodeId,String referencedNodeCode) {}
