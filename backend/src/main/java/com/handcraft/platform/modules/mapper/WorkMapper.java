package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.dto.WorkQueryDTO;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 品类→作者→作品→文件的锁序；首次提交计数必须处于作者锁内。 */
@Mapper
public interface WorkMapper {
    String COLUMNS="w.id,w.creator_id,w.create_request_key,w.version,w.category_id,w.title,w.main_image_ids,w.specification_image_ids,w.material,w.specification,w.description,w.process_description,w.sale_enabled,w.custom_enabled,w.stock_price,w.custom_reference_days,w.review_status,w.stock_status,w.stock_order_id,w.source_order_id,w.first_submitted_at,w.submitted_at,w.online_at,w.deleted_at,w.created_at,w.updated_at";
    // 已上架作品可沿用原一级品类，同时按当前启停状态和认证主品类判断能否发起交易。
    String ELIGIBLE="""
        (u.certification_status='APPROVED' AND u.is_admin=0 AND u.creator_paused=0 AND u.admin_business_paused=0
          AND EXISTS (
            SELECT 1 FROM category chosen
            JOIN category root ON root.id=COALESCE(chosen.parent_id,chosen.id)
            JOIN creator_application_category matched ON matched.category_id=root.id
              AND matched.application_id=u.approved_application_id
            WHERE chosen.id=w.category_id AND chosen.enabled=1 AND root.enabled=1
          ))
        """;
    String PURCHASABLE="("+ELIGIBLE+" AND w.sale_enabled=1 AND w.stock_status='AVAILABLE' AND w.source_order_id IS NULL AND w.stock_price IS NOT NULL)";
    // 来源品类若已细分，新需求至少要有一个启用的末级子类可选。
    String CUSTOMIZABLE="("+ELIGIBLE+" AND w.custom_enabled=1 AND " + """
        (NOT EXISTS (SELECT 1 FROM category child WHERE child.parent_id=w.category_id)
          OR EXISTS (SELECT 1 FROM category child WHERE child.parent_id=w.category_id AND child.enabled=1)))
        """;
    /** 草稿仅作者可见，驳回或下架后的私下修改不能覆盖管理员看到的材料。 */
    String ADMIN_WORKS=" FROM work w LEFT JOIN operation_log audit ON audit.id=(SELECT a.id FROM operation_log a"
        +" WHERE a.target_type='WORK' AND a.target_id=w.id AND ((w.review_status='REJECTED' AND a.action='SUBMIT')"
        +" OR (w.review_status='OFFLINE' AND a.action IN ('OFFLINE','ADMIN_OFFLINE'))) ORDER BY a.id DESC LIMIT 1)"
        +" WHERE w.deleted_at IS NULL AND w.review_status!='DRAFT'";
    String LIVE_MATERIAL="w.review_status IN ('PENDING','ONLINE')";
    String AUDIT_SNAPSHOT="JSON_EXTRACT(audit.detail,'$.snapshot')";
    String ADMIN_TITLE="CASE WHEN "+LIVE_MATERIAL+" THEN w.title ELSE JSON_UNQUOTE(JSON_EXTRACT("+AUDIT_SNAPSHOT+",'$.title')) END";
    String ADMIN_DESCRIPTION="CASE WHEN "+LIVE_MATERIAL+" THEN w.description ELSE JSON_UNQUOTE(JSON_EXTRACT("+AUDIT_SNAPSHOT+",'$.description')) END";
    String AUDIT_UPDATED_AT="CASE WHEN "+LIVE_MATERIAL+" THEN w.updated_at ELSE COALESCE(audit.created_at,w.submitted_at,w.created_at) END";
    String ADMIN_FILTER=ADMIN_WORKS
        +"<if test='q.status != null and q.status != &quot;ALL&quot;'> AND w.review_status=#{q.status}</if>"
        +"<if test='q.keyword != null and q.keyword != &quot;&quot;'> AND (LOCATE(#{q.keyword},"+ADMIN_TITLE+")&gt;0 OR LOCATE(#{q.keyword},"+ADMIN_DESCRIPTION+")&gt;0)</if>";
    String ADMIN_COLUMNS=COLUMNS+","+AUDIT_SNAPSHOT+" AS admin_snapshot,"+AUDIT_UPDATED_AT+" AS admin_updated_at";
    String ADMIN_HISTORY_ACTIONS=" AND action IN ('SUBMIT','WITHDRAW','REVIEW','OFFLINE','ADMIN_OFFLINE','TRADING_SETTINGS','REPORT_RESTORE','STOCK_RESTORE')";
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
    /** 付款后标记已售出，保留订单编号供作者日后依据全额退款恢复直购。 */
    @Update("UPDATE work SET stock_status='SOLD_OUT',updated_at=#{now} WHERE id=#{workId} AND stock_status='RESERVED' AND stock_order_id=#{orderId}")
    int sellStock(@Param("workId")Long workId,@Param("orderId")Long orderId,@Param("now")LocalDateTime now);
    /** 仅原售出订单全额退款并取消待结算后，才提供恢复直购依据。 */
    @Select("""
        <script>
        SELECT o.id,o.order_no,o.work_id,o.shipped_at
        FROM work w JOIN trade_order o ON o.id=w.stock_order_id AND o.work_id=w.id AND o.creator_id=w.creator_id
        JOIN fund_flow paid ON paid.success_order_id=o.id AND paid.flow_type='PAYMENT'
        JOIN fund_flow refunded ON refunded.success_order_id=o.id AND refunded.flow_type='REFUND'
        JOIN refund_application a ON a.id=refunded.refund_application_id AND a.order_id=o.id
          AND a.buyer_id=o.buyer_id AND a.status='REFUNDED'
        JOIN order_settlement s ON s.order_id=o.id AND s.status='CANCELLED'
        WHERE w.deleted_at IS NULL AND w.review_status='ONLINE' AND w.stock_status='SOLD_OUT'
          AND w.source_order_id IS NULL AND o.order_type='STOCK' AND o.status='REFUNDED'
          AND paid.amount=o.total_amount AND refunded.amount=paid.amount AND s.paid_amount=paid.amount
          AND NOT EXISTS(SELECT 1 FROM trade_order active_order WHERE active_order.active_stock_work_id=w.id)
          AND w.id IN
          <foreach collection="workIds" item="workId" open="(" separator="," close=")">#{workId}</foreach>
        </script>
        """)
    List<TradeOrder> stockRecoveryOrders(@Param("workIds") List<Long> workIds);
    /** 原售出关联和作品版本均须匹配，避免旧请求影响后续的现货订单。 */
    @Update("""
        UPDATE work SET stock_status='AVAILABLE',stock_order_id=NULL,sale_enabled=1,
          stock_price=#{price},version=version+1,updated_at=#{now}
        WHERE id=#{workId} AND creator_id=#{creatorId} AND version=#{version}
          AND review_status='ONLINE' AND deleted_at IS NULL AND source_order_id IS NULL
          AND stock_status='SOLD_OUT' AND stock_order_id=#{orderId}
        """)
    int restoreStock(@Param("workId") Long workId,@Param("creatorId") Long creatorId,@Param("version") Long version,
                     @Param("orderId") Long orderId,@Param("price") BigDecimal price,@Param("now") LocalDateTime now);
    @Select("SELECT "+COLUMNS+" FROM work w WHERE w.creator_id=#{creatorId} AND w.create_request_key=#{key}") Work findRequest(@Param("creatorId")Long creatorId,@Param("key")String key);
    @Insert("INSERT INTO work(creator_id,create_request_key,category_id,title,main_image_ids,specification_image_ids,material,specification,description,process_description,sale_enabled,custom_enabled,stock_price,custom_reference_days,stock_status,source_order_id) VALUES(#{creatorId},#{createRequestKey},#{categoryId},#{title},#{mainImageIds},#{specificationImageIds},#{material},#{specification},#{description},#{processDescription},#{saleEnabled},#{customEnabled},#{stockPrice},#{customReferenceDays},#{stockStatus},#{sourceOrderId})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(Work value);
    @Update("UPDATE work SET category_id=#{categoryId},title=#{title},main_image_ids=#{mainImageIds},specification_image_ids=#{specificationImageIds},material=#{material},specification=#{specification},description=#{description},process_description=#{processDescription},sale_enabled=#{saleEnabled},custom_enabled=#{customEnabled},stock_price=#{stockPrice},custom_reference_days=#{customReferenceDays},stock_status=#{stockStatus},source_order_id=#{sourceOrderId},review_status=#{reviewStatus},first_submitted_at=#{firstSubmittedAt},submitted_at=#{submittedAt},online_at=#{onlineAt},deleted_at=#{deletedAt},version=version+1 WHERE id=#{id} AND version=#{version}")
    int update(Work value);
    @Select("SELECT COUNT(*) FROM work WHERE creator_id=#{id} AND first_submitted_at >= #{start} AND first_submitted_at < #{end}")
    long countSubmitted(@Param("id")Long id,@Param("start")LocalDateTime start,@Param("end")LocalDateTime end);
    @Select("<script>SELECT "+COLUMNS+FILTER+"<choose><when test='mode == &quot;PUBLIC&quot; and q.sort == &quot;PRICE_ASC&quot;'> ORDER BY "+PURCHASABLE+" DESC,CASE WHEN "+PURCHASABLE+" THEN w.stock_price END ASC,w.online_at DESC,w.id DESC</when><when test='mode == &quot;PUBLIC&quot; and q.sort == &quot;PRICE_DESC&quot;'> ORDER BY "+PURCHASABLE+" DESC,CASE WHEN "+PURCHASABLE+" THEN w.stock_price END DESC,w.online_at DESC,w.id DESC</when><when test='mode == &quot;PUBLIC&quot;'> ORDER BY w.online_at DESC,w.id DESC</when><otherwise> ORDER BY w.updated_at DESC,w.id DESC</otherwise></choose> LIMIT #{size} OFFSET #{offset}</script>")
    List<Work> list(@Param("actor")Long actor,@Param("mode")String mode,@Param("q")WorkQueryDTO q,@Param("offset")int offset,@Param("size")int size);
    @Select("<script>SELECT COUNT(*) "+FILTER+"</script>") long count(@Param("actor")Long actor,@Param("mode")String mode,@Param("q")WorkQueryDTO q);
    @Select("SELECT "+ADMIN_COLUMNS+ADMIN_WORKS+" AND w.id=#{id}") Work adminWork(Long id);
    @Select("<script>SELECT "+ADMIN_COLUMNS+ADMIN_FILTER+"<choose><when test='q.status == &quot;PENDING&quot;'> ORDER BY w.submitted_at,w.id</when>"
        +"<otherwise> ORDER BY admin_updated_at DESC,w.id DESC</otherwise></choose> LIMIT #{size} OFFSET #{offset}</script>")
    List<Work> adminList(@Param("q")WorkQueryDTO query,@Param("offset")int offset,@Param("size")int size);
    @Select("<script>SELECT COUNT(*) "+ADMIN_FILTER+"</script>") long adminCount(@Param("q")WorkQueryDTO query);
    @Select("<script>SELECT id,operator_id,operator_type,action,before_status,after_status,reason,detail,created_at FROM operation_log WHERE target_type='WORK' AND target_id=#{id}"
        +"<if test='admin'>"+ADMIN_HISTORY_ACTIONS+"</if> ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}</script>")
    List<WorkOperation> history(@Param("id")Long id,@Param("admin")boolean admin,@Param("offset")int offset,@Param("size")int size);
    @Select("<script>SELECT COUNT(*) FROM operation_log WHERE target_type='WORK' AND target_id=#{id}<if test='admin'>"+ADMIN_HISTORY_ACTIONS+"</if></script>")
    long historyCount(@Param("id")Long id,@Param("admin")boolean admin);
    @Select("SELECT JSON_EXTRACT(detail,'$.snapshot') FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action='SUBMIT' AND id < #{logId} ORDER BY id DESC LIMIT 1")
    String precedingSubmittedSnapshot(@Param("id")Long id,@Param("logId")Long logId);
    @Select("SELECT id,action,detail FROM operation_log WHERE target_type='WORK' AND target_id=#{id} ORDER BY id DESC LIMIT 1")
    WorkOperation latestOperation(Long id);
    @Select("SELECT JSON_UNQUOTE(JSON_EXTRACT(detail,'$.snapshot.title')) FROM operation_log WHERE target_type='WORK' AND target_id=#{id}"
        +" AND after_status IN ('ONLINE','OFFLINE') AND action IN ('REVIEW','OFFLINE','ADMIN_OFFLINE','REPORT_RESTORE') ORDER BY id DESC LIMIT 1")
    String lastPublishedTitle(Long id);
    @Select("SELECT detail FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action='CREATE' ORDER BY id LIMIT 1") String creationDetail(Long id);
    @Select("SELECT detail FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action='SUBMIT' ORDER BY id DESC LIMIT 1") String submissionDetail(Long id);
    @Select("SELECT reason FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action IN ('REVIEW','ADMIN_OFFLINE') ORDER BY id DESC LIMIT 1") String reviewReason(Long id);
    @Select("SELECT detail FROM operation_log WHERE target_type='WORK' AND target_id=#{id} AND action='REVIEW' ORDER BY id DESC LIMIT 1") String reviewDetail(Long id);
    /** 作品、操作历史及现货订单快照均可保留作品图片。 */
    @Select("""
        SELECT (SELECT COUNT(*) FROM work w WHERE w.creator_id=#{userId} AND (
                    JSON_CONTAINS(w.main_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))
                    OR JSON_CONTAINS(w.specification_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))))
             + (SELECT COUNT(*) FROM operation_log l JOIN work w ON l.target_type='WORK' AND l.target_id=w.id
                WHERE w.creator_id=#{userId} AND JSON_SEARCH(l.detail,'one',CAST(#{fileId} AS CHAR),NULL,
                      '$.snapshot.mainImageIds[*]','$.snapshot.specificationImageIds[*]',
                      '$.before.mainImageIds[*]','$.before.specificationImageIds[*]',
                      '$.after.mainImageIds[*]','$.after.specificationImageIds[*]') IS NOT NULL)
             + (SELECT COUNT(*) FROM trade_order o JOIN file_asset f ON f.id=#{fileId}
                WHERE o.creator_id=#{userId} AND
        """ + OrderImageMapper.STOCK_SNAPSHOT_HAS_FILE + ")")
    int countImageReferences(@Param("userId")Long userId,@Param("fileId")Long fileId);
    @Select("SELECT COUNT(*) FROM work WHERE deleted_at IS NULL AND review_status='ONLINE' AND (JSON_CONTAINS(main_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) OR JSON_CONTAINS(specification_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))") int countPublicImageReferences(Long fileId);
    @Select("SELECT COUNT(*) FROM work WHERE creator_id=#{id} AND deleted_at IS NULL AND review_status='ONLINE'") long publicCount(Long id);
    /** 后台审核私图只从当前审核材料及已提交、已公开的操作快照查找。 */
    @Select("SELECT (SELECT COUNT(*) FROM work w WHERE w.creator_id=#{userId} AND w.deleted_at IS NULL AND w.review_status='PENDING'"
        +" AND (JSON_CONTAINS(w.main_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) OR JSON_CONTAINS(w.specification_image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))))"
        +" + (SELECT COUNT(*) FROM operation_log l JOIN work w ON l.target_type='WORK' AND l.target_id=w.id"
        +" WHERE w.creator_id=#{userId} AND (l.action IN ('REVIEW','OFFLINE','ADMIN_OFFLINE','REPORT_RESTORE')"
        +" OR (w.deleted_at IS NULL AND w.review_status!='DRAFT' AND l.action IN ('SUBMIT','WITHDRAW')))"
        +" AND JSON_SEARCH(l.detail,'one',CAST(#{fileId} AS CHAR),NULL,'$.snapshot.mainImageIds[*]','$.snapshot.specificationImageIds[*]') IS NOT NULL)")
    int countAdminImageReferences(@Param("userId")Long userId,@Param("fileId")Long fileId);
}
