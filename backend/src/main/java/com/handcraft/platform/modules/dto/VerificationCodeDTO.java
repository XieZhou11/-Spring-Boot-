package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Locale;

/** 验证码申请参数，注册和找回密码共用，不接收用途字段。 */
@Getter
@Setter
@NoArgsConstructor
public class VerificationCodeDTO {

    /** 接收验证码的邮箱，去除首尾空白并转小写后校验。 */
    @NotBlank(message = "邮箱不能为空")
    @Size(max = 254, message = "邮箱长度不能超过 254 个字符")
    @Email(message = "请输入正确的邮箱地址")
    @Pattern(regexp = "[^\\s@]+@(qq\\.com|163\\.com)", message = "仅支持 QQ 邮箱和 163 邮箱")
    private String email;

    public VerificationCodeDTO(String email) {
        setEmail(email);
    }

    public void setEmail(String email) {
        this.email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
