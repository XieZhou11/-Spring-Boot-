package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Locale;

/** 邮箱找回密码参数，无须原登录会话，不生成包含密码或验证码的 toString。 */
@Getter
@Setter
@NoArgsConstructor
public class PasswordResetDTO {

    /** 待找回账号的邮箱，去除首尾空白并转小写后校验。 */
    @NotBlank(message = "邮箱不能为空")
    @Size(max = 254, message = "邮箱长度不能超过 254 个字符")
    @Email(message = "请输入正确的邮箱地址")
    @Pattern(regexp = "[^\\s@]+@(qq\\.com|163\\.com)", message = "仅支持 QQ 邮箱和 163 邮箱")
    private String email;

    /** 邮箱中的最新六位验证码，与注册共用，重置成功后失效。 */
    @NotBlank(message = "验证码不能为空")
    @Pattern(regexp = "[0-9]{6}", message = "验证码必须为六位数字")
    private String verificationCode;

    /** 新密码，需为 8—20 位且同时包含字母和数字，不允许空白。 */
    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 20, message = "密码需为 8—20 位")
    @Pattern(
            regexp = "(?U)(?=.*[a-zA-Z])(?=.*[0-9])[^\\s\\p{Z}]+",
            message = "密码需包含字母和数字，且不能包含空白字符")
    private String newPassword;

    public PasswordResetDTO(String email, String verificationCode, String newPassword) {
        setEmail(email);
        this.verificationCode = verificationCode;
        this.newPassword = newPassword;
    }

    public void setEmail(String email) {
        this.email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
