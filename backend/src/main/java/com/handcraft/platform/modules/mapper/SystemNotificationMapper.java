package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.SystemNotification;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 通知归属、未读与业务事件唯一约束均由数据库维护。 */
@Mapper
public interface SystemNotificationMapper {
    String COLUMNS="id,recipient_id,event_type,event_key,title,content,business_reference,read_at,created_at";
    @Insert("INSERT INTO system_notification(recipient_id,event_type,event_key,title,content,business_reference) VALUES(#{recipientId},#{eventType},#{eventKey},#{title},#{content},#{businessReference})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(SystemNotification value);
    @Select("SELECT "+COLUMNS+" FROM system_notification WHERE id=#{id}") SystemNotification find(Long id);
    @Select("SELECT "+COLUMNS+" FROM system_notification WHERE recipient_id=#{userId} ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}")
    List<SystemNotification> list(@Param("userId")Long userId,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM system_notification WHERE recipient_id=#{userId}") long count(Long userId);
    @Select("SELECT COUNT(*) FROM system_notification WHERE recipient_id=#{userId} AND read_at IS NULL") long unread(Long userId);
    @Update("UPDATE system_notification SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP(3)) WHERE id=#{id} AND recipient_id=#{userId}")
    int read(@Param("userId")Long userId,@Param("id")Long id);
}
