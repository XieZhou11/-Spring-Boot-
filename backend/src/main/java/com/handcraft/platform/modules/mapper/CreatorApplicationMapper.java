package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.CreatorApplication;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 认证写入按账号→申请顺序加锁，原材料一经提交不覆盖。 */
@Mapper
public interface CreatorApplicationMapper {
    String COLUMNS="id,user_id,request_key,real_name,contact_phone,province,city,district,experience_years,introduction,original_works,alipay_account_ciphertext,supporting_description,status,reviewer_id,review_reason,submitted_at,reviewed_at,withdrawn_at";
    @Select("SELECT "+COLUMNS+" FROM creator_application WHERE id=#{id}") CreatorApplication find(Long id);
    @Select("SELECT "+COLUMNS+" FROM creator_application WHERE id=#{id} FOR UPDATE") CreatorApplication lock(Long id);
    @Select("SELECT "+COLUMNS+" FROM creator_application WHERE user_id=#{userId} AND request_key=#{key}")
    CreatorApplication findRequest(@Param("userId")Long userId,@Param("key")String key);
    @Select("SELECT "+COLUMNS+" FROM creator_application WHERE user_id=#{userId} ORDER BY submitted_at DESC,id DESC LIMIT 1") CreatorApplication latest(Long userId);
    @Select("SELECT id FROM creator_application WHERE user_id=#{userId} AND id < #{id} ORDER BY id DESC LIMIT 1")
    Long previous(@Param("userId")Long userId,@Param("id")Long id);
    @Select("SELECT "+COLUMNS+" FROM creator_application WHERE user_id=#{userId} ORDER BY submitted_at DESC,id DESC LIMIT #{size} OFFSET #{offset}")
    List<CreatorApplication> own(@Param("userId")Long userId,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM creator_application WHERE user_id=#{id}") long countOwn(Long id);
    @Select("SELECT "+COLUMNS+" FROM creator_application WHERE status=#{status} ORDER BY submitted_at,id LIMIT #{size} OFFSET #{offset}")
    List<CreatorApplication> queue(@Param("status")String status,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM creator_application WHERE status=#{status}") long countQueue(String status);
    @Insert("INSERT INTO creator_application(user_id,request_key,real_name,contact_phone,province,city,district,experience_years,introduction,original_works,alipay_account_ciphertext,supporting_description) VALUES(#{userId},#{requestKey},#{realName},#{contactPhone},#{province},#{city},#{district},#{experienceYears},#{introduction},#{originalWorks},#{alipayAccountCiphertext},#{supportingDescription})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(CreatorApplication value);
    @Insert("INSERT INTO creator_application_category(application_id,category_id) VALUES(#{applicationId},#{categoryId})")
    int insertCategory(@Param("applicationId")Long applicationId,@Param("categoryId")Long categoryId);
    @Select("SELECT category_id FROM creator_application_category WHERE application_id=#{id} ORDER BY category_id") List<Long> categoryIds(Long id);
    @Update("UPDATE creator_application SET status='WITHDRAWN',withdrawn_at=CURRENT_TIMESTAMP(3) WHERE id=#{id} AND status='PENDING'") int withdraw(Long id);
    @Update("UPDATE creator_application SET status=#{decision},reviewer_id=#{reviewerId},review_reason=#{reason},reviewed_at=CURRENT_TIMESTAMP(3) WHERE id=#{id} AND status='PENDING'")
    int review(@Param("id")Long id,@Param("reviewerId")Long reviewerId,@Param("decision")String decision,@Param("reason")String reason);
    /** JSON内只保存字符串编号，检查所有历史引用，撤回和驳回材料也保留。 */
    @Select("SELECT COUNT(*) FROM creator_application WHERE user_id=#{userId} AND JSON_SEARCH(original_works,'one',CAST(#{fileId} AS CHAR),NULL,'$[*].finished_image_ids[*]','$[*].process_image_ids[*]') IS NOT NULL")
    int countImageReferences(@Param("userId")Long userId,@Param("fileId")Long fileId);
}
