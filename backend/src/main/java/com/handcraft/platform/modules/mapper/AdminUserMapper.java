package com.handcraft.platform.modules.mapper;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** 管理员账号检索及关联业务摘要，不返回认证申请中的私人材料。 */
@Mapper
public interface AdminUserMapper {
    String FILTER="<where>u.is_admin=0 <if test='q.email != null and q.email != &quot;&quot;'>AND LOCATE(LOWER(#{q.email}),u.email)&gt;0 </if><if test='q.nickname != null and q.nickname != &quot;&quot;'>AND LOCATE(#{q.nickname},u.nickname)&gt;0 </if><if test='q.certificationStatus != null and q.certificationStatus != &quot;ALL&quot;'>AND u.certification_status=#{q.certificationStatus}</if></where>";
    String USER_COLUMNS="u.id AS userId,u.email AS email,u.nickname AS nickname,u.certification_status AS certificationStatus,u.creator_paused AS creatorPaused,u.admin_business_paused AS adminBusinessPaused,u.created_at AS createdAt";
    @Select("<script>SELECT "+USER_COLUMNS+" FROM user_account u "+FILTER+" ORDER BY u.created_at DESC,u.id DESC LIMIT #{q.size} OFFSET #{offset}</script>")
    List<Map<String,Object>> list(@Param("q")com.handcraft.platform.modules.dto.AdminUserQueryDTO query,@Param("offset")int offset);
    @Select("<script>SELECT COUNT(*) FROM user_account u "+FILTER+"</script>") long count(@Param("q")com.handcraft.platform.modules.dto.AdminUserQueryDTO query);
    @Select("SELECT "+USER_COLUMNS+" FROM user_account u WHERE u.id=#{id} AND u.is_admin=0") Map<String,Object> user(Long id);
    @Select("SELECT id AS id,title AS title,review_status AS status,created_at AS createdAt FROM work WHERE creator_id=#{id} AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 10") List<Map<String,Object>> works(Long id);
    @Select("SELECT id AS id,title AS title,status AS status,created_at AS createdAt FROM custom_request WHERE buyer_id=#{id} AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 10") List<Map<String,Object>> requests(Long id);
    @Select("SELECT id AS id,order_no AS orderNo,order_type AS orderType,status AS status,total_amount AS amount,created_at AS createdAt FROM trade_order WHERE buyer_id=#{id} OR creator_id=#{id} ORDER BY created_at DESC,id DESC LIMIT 10") List<Map<String,Object>> orders(Long id);
    @Select("SELECT COUNT(*) FROM work WHERE creator_id=#{id} AND deleted_at IS NULL") long workCount(Long id);
    @Select("SELECT COUNT(*) FROM custom_request WHERE buyer_id=#{id} AND deleted_at IS NULL") long requestCount(Long id);
    @Select("SELECT COUNT(*) FROM trade_order WHERE buyer_id=#{id} OR creator_id=#{id}") long orderCount(Long id);
    /** 暂停与人工恢复均只追加，管理员详情可追溯处理原因。 */
    @Select("SELECT operator_id AS operatorId,action AS action,before_status AS beforeStatus,after_status AS afterStatus,reason AS reason,JSON_UNQUOTE(JSON_EXTRACT(detail,'$.recoveryCondition')) AS recoveryCondition,created_at AS createdAt FROM operation_log WHERE target_type='USER' AND target_id=#{id} AND action IN ('ADMIN_BUSINESS_PAUSE','ADMIN_BUSINESS_RESUME','CREATOR_PAUSE','CREATOR_RESUME') ORDER BY created_at DESC,id DESC LIMIT 20")
    List<Map<String,Object>> pauseHistory(Long id);
}
