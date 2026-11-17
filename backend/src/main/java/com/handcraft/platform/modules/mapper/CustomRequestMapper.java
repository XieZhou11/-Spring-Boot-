package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.entity.CustomRequest;
import com.handcraft.platform.modules.dto.CustomRequestQueryDTO;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 需求行锁保护发布、关闭与会话创建；有效过期同时用于只读列表和写入校验。 */
@Mapper
public interface CustomRequestMapper {
    String EFFECTIVE="CASE WHEN r.status IN ('OPEN','QUOTING') THEN CASE WHEN EXISTS (SELECT 1 FROM quote z WHERE z.request_id=r.id AND z.status='ACTIVE' AND z.expires_at &gt; #{now}) THEN 'QUOTING' WHEN r.no_quote_expire_at &lt;= #{now} THEN 'EXPIRED' ELSE 'OPEN' END ELSE r.status END";
    @Select("SELECT * FROM custom_request WHERE id=#{id}") CustomRequest find(Long id);
    /** 锁后不复用锁前可见性或有效报价的一级缓存快照。 */
    @Select("SELECT * FROM custom_request WHERE id=#{id} FOR UPDATE") @Options(flushCache=Options.FlushCachePolicy.TRUE) CustomRequest lock(Long id);
    @Select("SELECT * FROM custom_request WHERE buyer_id=#{userId} AND create_request_key=#{key}") CustomRequest findKey(@Param("userId")Long userId,@Param("key")String key);
    @Select("SELECT detail FROM operation_log WHERE target_type='CUSTOM_REQUEST' AND target_id=#{id} AND action='CREATE' ORDER BY id LIMIT 1") String creationDetail(Long id);
    @Insert("""
        INSERT INTO custom_request(buyer_id,create_request_key,title,category_id,purpose,material_preference,specification,budget_min,budget_max,expected_ship_date,reference_image_ids,description,visibility,invited_creator_id,source_work_id)
        VALUES(#{buyerId},#{createRequestKey},#{title},#{categoryId},#{purpose},#{materialPreference},#{specification},#{budgetMin},#{budgetMax},#{expectedShipDate},#{referenceImageIds},#{description},#{visibility},#{invitedCreatorId},#{sourceWorkId})
        """)
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(CustomRequest r);
    @Update("""
        UPDATE custom_request SET title=#{title},category_id=#{categoryId},purpose=#{purpose},material_preference=#{materialPreference},specification=#{specification},budget_min=#{budgetMin},budget_max=#{budgetMax},expected_ship_date=#{expectedShipDate},reference_image_ids=#{referenceImageIds},description=#{description},visibility=#{visibility},invited_creator_id=#{invitedCreatorId},source_work_id=#{sourceWorkId},status=#{status},published_at=#{publishedAt},no_quote_expire_at=#{noQuoteExpireAt},closed_at=#{closedAt},deleted_at=#{deletedAt},version=version+1,updated_at=#{updatedAt} WHERE id=#{id} AND version=#{version}
        """) int update(CustomRequest r);
    @Select("SELECT COUNT(*) FROM quote WHERE request_id=#{id} AND status='ACTIVE' AND expires_at>#{now}") long effectiveQuotes(@Param("id")Long id,@Param("now")LocalDateTime now);
    @Update("UPDATE quote SET status='EXPIRED',invalid_reason=#{reason} WHERE request_id=#{id} AND status='ACTIVE'") int invalidateQuotes(@Param("id")Long id,@Param("reason")String reason);
    @Select("SELECT COUNT(*) FROM custom_request r WHERE buyer_id=#{userId} AND deleted_at IS NULL AND status IN ('OPEN','QUOTING') AND (no_quote_expire_at>#{now} OR EXISTS (SELECT 1 FROM quote q WHERE q.request_id=r.id AND q.status='ACTIVE' AND q.expires_at>#{now}))")
    long used(@Param("userId")Long userId,@Param("now")LocalDateTime now);
    String FILTER="""
        <where>r.deleted_at IS NULL
        <choose>
          <when test="mode == 'PUBLIC'">AND r.visibility='PUBLIC' AND ("""+EFFECTIVE+"""
          ) IN ('OPEN','QUOTING')
          <if test="!q.allCategories and q.categoryId == null">AND COALESCE((SELECT c.parent_id FROM category c WHERE c.id=r.category_id),r.category_id) IN <foreach collection="mainIds" item="x" open="(" separator="," close=")">#{x}</foreach></if>
          </when>
          <when test="mode == 'INVITED'">AND r.invited_creator_id=#{userId} AND r.visibility='DIRECTED' AND r.status!='DRAFT'</when>
          <otherwise>AND r.buyer_id=#{userId}</otherwise>
        </choose>
        <if test="q.status != null and q.status != 'ALL'">AND ("""+EFFECTIVE+"""
        )=#{q.status}</if>
        <if test="q.categoryId != null">AND (r.category_id=#{q.categoryId} OR r.category_id IN (SELECT c.id FROM category c WHERE c.parent_id=#{q.categoryId}))</if>
        <if test="q.minBudget != null">AND r.budget_max &gt;= #{q.minBudget}</if>
        <if test="q.maxBudget != null">AND r.budget_min &lt;= #{q.maxBudget}</if>
        <if test="after != null">AND r.published_at &gt;= #{after}</if>
        <if test="before != null">AND r.published_at &lt; #{before}</if>
        </where>
        """;
    @Select("<script>SELECT r.* FROM custom_request r "+FILTER+" ORDER BY COALESCE(r.published_at,r.created_at) DESC,r.id DESC LIMIT #{size} OFFSET #{offset}</script>")
    List<CustomRequest> list(@Param("userId")Long userId,@Param("mode")String mode,@Param("q")CustomRequestQueryDTO q,@Param("mainIds")List<Long> mainIds,@Param("now")LocalDateTime now,@Param("after")LocalDateTime after,@Param("before")LocalDateTime before,@Param("offset")int offset,@Param("size")int size);
    @Select("<script>SELECT COUNT(*) FROM custom_request r "+FILTER+"</script>")
    long count(@Param("userId")Long userId,@Param("mode")String mode,@Param("q")CustomRequestQueryDTO q,@Param("mainIds")List<Long> mainIds,@Param("now")LocalDateTime now,@Param("after")LocalDateTime after,@Param("before")LocalDateTime before);
    @Select("SELECT r.id FROM custom_request r WHERE r.status IN ('OPEN','QUOTING') AND r.deleted_at IS NULL AND r.no_quote_expire_at<=#{now} AND NOT EXISTS (SELECT 1 FROM quote q WHERE q.request_id=r.id AND q.status='ACTIVE' AND q.expires_at>#{now}) ORDER BY r.id LIMIT 100")
    List<Long> due(LocalDateTime now);
    /** 草稿、逻辑删除与历史操作引用都保留，清理不能破坏历史。 */
    @Select("SELECT COUNT(*) FROM custom_request r WHERE r.buyer_id=#{userId} AND (JSON_CONTAINS(r.reference_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) OR EXISTS (SELECT 1 FROM operation_log l WHERE l.target_type='CUSTOM_REQUEST' AND l.target_id=r.id AND JSON_SEARCH(l.detail,'one',CAST(#{fileId} AS CHAR),NULL,'$.snapshot.referenceImageIds[*]') IS NOT NULL))")
    long imageReferences(@Param("userId")Long userId,@Param("fileId")Long fileId);
    @Select("SELECT * FROM custom_request WHERE JSON_CONTAINS(reference_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))") List<CustomRequest> imageRequests(Long fileId);
}
