package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.EmailVerificationCode;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

/** 最新码由唯一索引和行锁保护，发送回写必须匹配当前请求键。 */
@Mapper
public interface EmailVerificationCodeMapper {
    @Insert(
            """
            INSERT INTO email_verification_code(email,send_request_key,code_digest,send_status,expires_at)
            VALUES(#{email},#{sendRequestKey},#{codeDigest},'SENDING',#{expiresAt})
            ON DUPLICATE KEY UPDATE email=#{email}
            """)
    int ensureRow(EmailVerificationCode code);

    @Select(
            "SELECT email,send_request_key,code_digest,send_status,expires_at,used_at FROM"
                    + " email_verification_code WHERE email=#{email} FOR UPDATE")
    EmailVerificationCode lockByEmail(String email);

    @Insert(
            """
            INSERT INTO email_verification_code(email,send_request_key,code_digest,send_status,expires_at)
            VALUES(#{email},#{sendRequestKey},#{codeDigest},'SENDING',#{expiresAt})
            ON DUPLICATE KEY UPDATE send_request_key=#{sendRequestKey},code_digest=#{codeDigest},
                send_status='SENDING',expires_at=#{expiresAt},used_at=NULL
            """)
    int reserve(EmailVerificationCode code);

    @Update(
            """
            UPDATE email_verification_code SET send_status=#{status}
            WHERE email=#{email} AND send_request_key=#{requestKey} AND send_status='SENDING'
            """)
    int finish(
            @Param("email") String email,
            @Param("requestKey") String requestKey,
            @Param("status") String status);

    @Update(
            """
            UPDATE email_verification_code SET used_at=#{now}
            WHERE email=#{email} AND send_request_key=#{requestKey} AND send_status='SENT'
                AND used_at IS NULL AND expires_at>#{now}
            """)
    int consume(
            @Param("email") String email,
            @Param("requestKey") String requestKey,
            @Param("now") LocalDateTime now);
}
