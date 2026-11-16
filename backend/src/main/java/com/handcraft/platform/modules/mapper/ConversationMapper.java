package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.entity.*;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 消息、游标、限流与归档共用会话行锁，保证序号与计数一致。 */
@Mapper
public interface ConversationMapper {
    @Select("SELECT * FROM conversation WHERE id=#{id}") Conversation find(Long id);
    /** 并发锁等待结束后，游标和状态必须重新读取，不复用之前快照。 */
    @Select("SELECT * FROM conversation WHERE id=#{id} FOR UPDATE") @Options(flushCache=Options.FlushCachePolicy.TRUE) Conversation lock(Long id);
    @Select("SELECT * FROM conversation WHERE request_id=#{requestId} AND creator_id=#{creatorId}") Conversation byRequest(@Param("requestId")Long requestId,@Param("creatorId")Long creatorId);
    @Insert("INSERT INTO conversation(buyer_id,creator_id,request_id,last_message_at,created_at) VALUES(#{buyerId},#{creatorId},#{requestId},#{lastMessageAt},#{createdAt})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(Conversation c);
    @Select("SELECT * FROM conversation WHERE buyer_id=#{userId} OR creator_id=#{userId} ORDER BY last_message_at DESC,id DESC LIMIT #{size} OFFSET #{offset}")
    List<Conversation> list(@Param("userId")Long userId,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM conversation WHERE buyer_id=#{id} OR creator_id=#{id}") long count(Long id);
    @Select("SELECT * FROM conversation WHERE request_id=#{id} ORDER BY id") List<Conversation> forRequest(Long id);
    @Update("UPDATE conversation SET archived_at=#{now},archive_reason=#{reason} WHERE request_id=#{id} AND order_id IS NULL AND archived_at IS NULL")
    int archive(@Param("id")Long id,@Param("reason")String reason,@Param("now")LocalDateTime now);
    @Update("UPDATE conversation SET last_message_seq=#{lastMessageSeq},last_message_at=#{lastMessageAt},buyer_read_seq=#{buyerReadSeq},creator_read_seq=#{creatorReadSeq},buyer_cooldown_until=#{buyerCooldownUntil},creator_cooldown_until=#{creatorCooldownUntil},updated_at=#{updatedAt} WHERE id=#{id}") int update(Conversation c);
    @Select("SELECT COUNT(*) FROM chat_message WHERE conversation_id=#{id} AND sender_id!=#{userId} AND seq_no>#{seq}")
    long unreadIn(@Param("id")Long id,@Param("userId")Long userId,@Param("seq")Long seq);
    @Select("SELECT COUNT(*) FROM chat_message m JOIN conversation c ON c.id=m.conversation_id WHERE m.sender_id!=#{userId} AND ((c.buyer_id=#{userId} AND m.seq_no>c.buyer_read_seq) OR (c.creator_id=#{userId} AND m.seq_no>c.creator_read_seq))") long unread(Long userId);
    @Select("SELECT * FROM chat_message WHERE sender_id=#{userId} AND client_message_key=#{key}") ChatMessage messageKey(@Param("userId")Long userId,@Param("key")String key);
    @Select("SELECT COUNT(*) FROM chat_message WHERE conversation_id=#{id} AND sender_id=#{userId} AND created_at>#{after}") long sentSince(@Param("id")Long id,@Param("userId")Long userId,@Param("after")LocalDateTime after);
    @Select("SELECT COUNT(*) FROM chat_message WHERE conversation_id=#{id} AND sender_id=#{userId} AND created_at>#{after} AND BINARY content=BINARY #{content}") long repeatedText(@Param("id")Long id,@Param("userId")Long userId,@Param("after")LocalDateTime after,@Param("content")String content);
    @Insert("INSERT INTO chat_message(conversation_id,seq_no,sender_id,client_message_key,content,image_ids,created_at) VALUES(#{conversationId},#{seqNo},#{senderId},#{clientMessageKey},#{content},#{imageIds},#{createdAt})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertMessage(ChatMessage m);
    @Select("<script>SELECT * FROM chat_message WHERE conversation_id=#{id}<if test='before != null'> AND seq_no &lt; #{before}</if><if test='after != null'> AND seq_no &gt; #{after}</if> ORDER BY seq_no <choose><when test='after != null'>ASC</when><otherwise>DESC</otherwise></choose> LIMIT #{size}</script>")
    List<ChatMessage> messages(@Param("id")Long id,@Param("before")Long before,@Param("after")Long after,@Param("size")int size);
    /** 对方只可读取已由本会话消息引用的图片，不能猜测上传者尚未发送的临时图片。 */
    @Select("SELECT COUNT(*) FROM chat_message WHERE conversation_id=#{conversationId} AND JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))")
    long conversationImageReferences(@Param("conversationId")Long conversationId,@Param("fileId")Long fileId);
    @Select("SELECT COUNT(*) FROM chat_message WHERE JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))") long imageReferences(Long fileId);
}
