package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.UserAccount;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/** 显式参数化账号 SQL；权限字段只由服务端写入。 */
@Mapper
public interface UserAccountMapper {
    String COLUMNS = "id,email,password_hash,nickname,avatar_file_id,bio,is_admin AS admin,certification_status,approved_application_id,creator_paused,admin_business_paused";

    @Select("SELECT " + COLUMNS + " FROM user_account WHERE email=#{email}")
    UserAccount findByEmail(String email);

    @Select("SELECT " + COLUMNS + " FROM user_account WHERE id=#{id}")
    UserAccount findById(Long id);

    /** 需求定向选择器仅列出同主品类可接单的认证创作者，昵称按字面包含匹配。 */
    @Select("SELECT "+COLUMNS+" FROM user_account u WHERE u.id!=#{userId} AND u.is_admin=0 AND u.certification_status='APPROVED' AND u.creator_paused=0 AND u.admin_business_paused=0 AND EXISTS(SELECT 1 FROM creator_application_category c WHERE c.application_id=u.approved_application_id AND c.category_id=#{rootId}) AND (#{keyword} IS NULL OR LOCATE(#{keyword},u.nickname)>0) ORDER BY u.id DESC LIMIT #{size} OFFSET #{offset}")
    java.util.List<UserAccount> customCandidates(@Param("userId")Long userId,@Param("rootId")Long rootId,@Param("keyword")String keyword,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM user_account u WHERE u.id!=#{userId} AND u.is_admin=0 AND u.certification_status='APPROVED' AND u.creator_paused=0 AND u.admin_business_paused=0 AND EXISTS(SELECT 1 FROM creator_application_category c WHERE c.application_id=u.approved_application_id AND c.category_id=#{rootId}) AND (#{keyword} IS NULL OR LOCATE(#{keyword},u.nickname)>0)")
    long customCandidateCount(@Param("userId")Long userId,@Param("rootId")Long rootId,@Param("keyword")String keyword);

    /** 用户行锁串行化资格和额度；清除事务内锁前快照，取锁后重新查询必须看到最新提交。 */
    @Select("SELECT " + COLUMNS + " FROM user_account WHERE id=#{id} FOR UPDATE")
    @Options(flushCache=Options.FlushCachePolicy.TRUE)
    UserAccount lockById(Long id);

    /** 仅更新用户可维护的公开资料，不接受权限或凭证字段。 */
    @Update("UPDATE user_account SET nickname=#{nickname},bio=#{bio} WHERE id=#{id}")
    int updateProfile(@Param("id") Long id, @Param("nickname") String nickname, @Param("bio") String bio);

    /** 文件状态及归属校验通过后，在同一事务中绑定头像。 */
    @Update("UPDATE user_account SET avatar_file_id=#{fileId} WHERE id=#{id}")
    int updateAvatar(@Param("id") Long id, @Param("fileId") Long fileId);

    @Select("SELECT " + COLUMNS + " FROM user_account WHERE email=#{email} FOR UPDATE")
    UserAccount lockByEmail(String email);

    @Insert(
            "INSERT INTO user_account(email,password_hash,nickname)"
                    + " VALUES(#{email},#{passwordHash},#{nickname})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(UserAccount account);

    @Update("UPDATE user_account SET password_hash=#{passwordHash} WHERE id=#{id}")
    int updatePassword(@Param("id") Long id, @Param("passwordHash") String passwordHash);

    /** 认证结论及通过申请引用由审核事务统一维护。 */
    @Update("UPDATE user_account SET certification_status=#{status},approved_application_id=#{applicationId} WHERE id=#{id}")
    int updateCertification(@Param("id")Long id,@Param("status")String status,@Param("applicationId")Long applicationId);

    /** 用户行锁内单独改变管理员暂停标记，不覆盖创作者本人暂停选择。 */
    @Update("UPDATE user_account SET admin_business_paused=#{paused} WHERE id=#{id}")
    int updateAdminBusinessPause(@Param("id")Long id,@Param("paused")boolean paused);

    /** 用户行锁内单独改变创作者本人暂停标记，不覆盖管理员处置。 */
    @Update("UPDATE user_account SET creator_paused=#{paused} WHERE id=#{id}")
    int updateCreatorPause(@Param("id")Long id,@Param("paused")boolean paused);
}
