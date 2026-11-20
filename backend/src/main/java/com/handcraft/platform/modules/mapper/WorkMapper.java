package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.dto.WorkQueryDTO;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 品类→作者→作品→文件的锁序；首次提交计数必须处于作者锁内。 */
@Mapper
public interface WorkMapper {
    String COLUMNS="w.id,w.creator_id,w.create_request_key,w.version,w.category_id,w.title,w.main_image_ids,w.specification_image_ids,w.material,w.specification,w.description,w.process_description,w.sale_enabled,w.custom_enabled,w.stock_price,w.custom_reference_days,w.review_status,w.stock_status,w.stock_order_id,w.source_order_id,w.first_submitted_at,w.submitted_at,w.online_at,w.deleted_at,w.created_at,w.updated_at";
    String ELIGIBLE="(u.certification_status='APPROVED' AND u.is_admin=0 AND u.creator_paused=0 AND u.admin_business_paused=0)";
    String PURCHASABLE="("+ELIGIBLE+" AND w.sale_enabled=1 AND w.stock_status='AVAILABLE' AND w.source_order_id IS NULL AND w.stock_price IS NOT NULL)";
    String CUSTOMIZABLE="("+ELIGIBLE+" AND w.custom_enabled=1)";
    String FILTER=" FROM work w JOIN user_account u ON u.id=w.creator_id WHERE w.deleted_at IS NULL "
       +"<if test='mode == &quot;PUBLIC&quot;'> AND w.review_status='ONLINE'"
       +"<if test='q.creatorId != null'> AND w.creator_id=#{q.creatorId}</if>"
       +"<if test='q.categoryId != null'> AND (w.category_id=#{q.categoryId} OR w.category_id IN (SELECT id FROM category WHERE parent_id=#{q.categoryId}))</if>"
       +"<if test='q.minPrice != null'> AND "+PURCHASABLE+" AND w.stock_price &gt;= #{q.minPrice}</if>"
       +"<if test='q.maxPrice != null'> AND "+PURCHASABLE+" AND w.stock_price &lt;= #{q.maxPrice}</if>"
       +"<if test='q.purchasable != null'> AND "+PURCHASABLE+"=#{q.purchasable}</if>"
       +"<if test='q.customizable != null'> AND "+CUSTOMIZABLE+"=#{q.customizable}</if></if>"
       +"<if test='mode == &quot;OWN&quot;'> AND w.creator_id=#{actor}</if>"
       +"<if test='mode != &quot;PUBLIC&quot; and q.status != null and q.status != &quot;ALL&quot;'> AND w.review_status=#{q.status}</if>"
       +"<if test='q.keyword != null and q.keyword != &quot;&quot;'> AND (LOCATE(#{q.keyword},w.title)&gt;0 OR LOCATE(#{q.keyword},w.description)&gt;0)</if>";
    @Select("SELECT "+COLUMNS+" FROM work w WHERE w.id=#{id}") Work find(Long id);
    @Select("SELECT "+COLUMNS+" FROM work w WHERE w.id=#{id} FOR UPDATE") Work lock(Long id);
    /** 锁订单的持有者后以状态条件锁定单件现货。 */
    @Update("UPDATE work SET stock_status='RESERVED',stock_order_id=#{orderId},updated_at=#{now} WHERE id=#{workId} AND stock_status='AVAILABLE' AND sale_enabled=1 AND review_status='ONLINE' AND deleted_at IS NULL")
    int reserveStock(@Param("workId")Long workId,@Param("orderId")Long orderId,@Param("now")LocalDateTime now);
    /** 只有对应待付款订单可释放自己的占用。 */
    @Update("UPDATE work SET stock_status='AVAILABLE',stock_order_id=NULL,updated_at=#{now} WHERE id=#{workId} AND stock_status='RESERVED' AND stock_order_id=#{orderId}")
    int releaseStock(@Param("workId")Long workId,@Param("orderId")Long orderId,@Param("now")LocalDateTime now);
    /** 付款将同一订单持有的锁定永久改为已售出，保留来源订单编号。 */
    @Update("UPDATE work SET stock_status='SOLD_OUT',updated_at=#{now} WHERE id=#{workId} AND stock_status='RESERVED' AND stock_order_id=#{orderId}")
    int sellStock(@Param("workId")Long workId,@Param("orderId")Long orderId,@Param("now")LocalDateTime now);
    @Select("SELECT "+COLUMNS+" FROM work w WHERE w.creator_id=#{creatorId} AND w.create_request_key=#{key}") Work findRequest(@Param("creatorId")Long creatorId,@Param("key")String key);
    @Insert("INSERT INTO work(creator_id,create_request_key,category_id,title,main_image_ids,specification_image_ids,material,specification,description,process_description,sale_enabled,custom_enabled,stock_price,custom_reference_days,stock_status,source_order_id) VALUES(#{creatorId},#{createRequestKey},#{categoryId},#{title},#{mainImageIds},#{specificationImageIds},#{material},#{specification},#{description},#{processDescription},#{saleEnabled},#{customEnabled},#{stockPrice},#{customReferenceDays},#{stockStatus},#{sourceOrderId})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(Work value);
    @Update("UPDATE work SET category_id=#{categoryId},title=#{title},main_image_ids=#{mainImageIds},specification_image_ids=#{specificationImageIds},material=#{material},specification=#{specification},description=#{description},process_description=#{processDescription},sale_enabled=#{saleEnabled},custom_enabled=#{customEnabled},stock_price=#{stockPrice},custom_reference_days=#{customReferenceDays},stock_status=#{stockStatus},source_order_id=#{sourceOrderId},review_status=#{reviewStatus},first_submitted_at=#{firstSubmittedAt},submitted_at=#{submittedAt},online_at=#{onlineAt},deleted_at=#{deletedAt},version=version+1 WHERE id=#{id} AND version=#{version}")
    int update(Work value);
    @Select("SELECT COUNT(*) FROM work WHERE creator_id=#{id} AND first_submitted_at >= #{start} AND first_submitted_at < #{end}")
    long countSubmitted(@Param("id")Long id,@Param("start")LocalDateTime start,@Param("end")LocalDateTime end);
    @Select("<script>SELECT "+COLUMNS+FILTER+"<choose><when test='mode == &quot;PUBLIC&quot; and q.sort == &quot;PRICE_ASC&quot;'> ORDER BY "+PURCHASABLE+" DESC,CASE WHEN "+PURCHASABLE+" THEN w.stock_price END ASC,w.online_at DESC,w.id DESC</when><when test='mode == &quot;PUBLIC&quot; and q.sort == &quot;PRICE_DESC&quot;'> ORDER BY "+PURCHASABLE+" DESC,CASE WHEN "+PURCHASABLE+" THEN w.stock_price END DESC,w.online_at DESC,w.id DESC</when><when test='mode == &quot;PUBLIC&quot;'> ORDER BY w.online_at DESC,w.id DESC</when><when test='mode == &quot;ADMIN&quot; and q.status == &quot;PENDING&quot;'> ORDER BY w.submitted_at,w.id</when><otherwise> ORDER BY w.updated_at DESC,w.id DESC</otherwise></choose> LIMIT #{size} OFFSET #{offset}</script>")
    List<Work> list(@Param("actor")Long actor,@Param("mode")String mode,@Param("q")WorkQueryDTO q,@Param("offset")int offset,@Param("size")int size);
    @Select("<script>SELECT COUNT(*) "+FILTER+"</script>") long count(@Param("actor")Long actor,@Param("mode")String mode,@Param("q")WorkQueryDTO q);
    @Select("SELECT id,operator_id,operator_type,action,before_status,after_status,reason,detail,created_at FROM operation_log WHERE target_type='WORK' AND target_id=#{id} ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}")
    List<WorkOperation> history(@Param("id")Long id,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM operation_log WHERE target_type='WORK' AND target_id=#{id}") long historyCount(Long id);
    @Select("SELECT detail FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action='CREATE' ORDER BY id LIMIT 1") String creationDetail(Long id);
    @Select("SELECT detail FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action='SUBMIT' ORDER BY id DESC LIMIT 1") String submissionDetail(Long id);
    @Select("SELECT reason FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action IN ('REVIEW','ADMIN_OFFLINE') ORDER BY id DESC LIMIT 1") String reviewReason(Long id);
    @Select("SELECT detail FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action='REVIEW' ORDER BY id DESC LIMIT 1") String reviewDetail(Long id);
    @Select("SELECT (SELECT COUNT(*) FROM work w WHERE creator_id=#{userId} AND (JSON_CONTAINS(main_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) OR JSON_CONTAINS(specification_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))) + (SELECT COUNT(*) FROM operation_log l JOIN work w ON l.target_type='WORK' AND l.target_id=w.id WHERE w.creator_id=#{userId} AND JSON_SEARCH(l.detail,'one',CAST(#{fileId} AS CHAR),NULL,'$.snapshot.mainImageIds[*]','$.snapshot.specificationImageIds[*]','$.before.mainImageIds[*]','$.before.specificationImageIds[*]','$.after.mainImageIds[*]','$.after.specificationImageIds[*]') IS NOT NULL)")
    int countImageReferences(@Param("userId")Long userId,@Param("fileId")Long fileId);
    @Select("SELECT COUNT(*) FROM work WHERE deleted_at IS NULL AND review_status='ONLINE' AND (JSON_CONTAINS(main_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) OR JSON_CONTAINS(specification_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))") int countPublicImageReferences(Long fileId);
    @Select("SELECT COUNT(*) FROM work WHERE creator_id=#{id} AND deleted_at IS NULL AND review_status='ONLINE'") long publicCount(Long id);
}
