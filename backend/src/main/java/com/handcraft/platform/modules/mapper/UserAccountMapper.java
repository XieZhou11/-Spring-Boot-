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
    String COLUMNS = "id,email,password_hash,nickname,is_admin AS admin,certification_status";

    @Select("SELECT " + COLUMNS + " FROM user_account WHERE email=#{email}")
    UserAccount findByEmail(String email);

    @Select("SELECT " + COLUMNS + " FROM user_account WHERE id=#{id}")
    UserAccount findById(Long id);

    @Select("SELECT " + COLUMNS + " FROM user_account WHERE email=#{email} FOR UPDATE")
    UserAccount lockByEmail(String email);

    @Insert(
            "INSERT INTO user_account(email,password_hash,nickname)"
                    + " VALUES(#{email},#{passwordHash},#{nickname})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(UserAccount account);

    @Update("UPDATE user_account SET password_hash=#{passwordHash} WHERE id=#{id}")
    int updatePassword(@Param("id") Long id, @Param("passwordHash") String passwordHash);
}
