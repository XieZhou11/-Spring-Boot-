package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Locale;

/** 邮箱密码登录参数，不接收客户端自报身份，不生成包含密码的 toString。 */
@Getter
@Setter
@NoArgsConstructor
public class LoginDTO {

    /** 登录邮箱，去除首尾空白并转小写后校验，仅支持 QQ 和 163 邮箱。 */
    @NotBlank(message = "邮箱不能为空")
    @Size(max = 254, message = "邮箱长度不能超过 254 个字符")
    @Email(message = "请输入正确的邮箱地址")
    @Pattern(regexp = "[^\\s@]+@(qq\\.com|163\\.com)", message = "仅支持 QQ 邮箱和 163 邮箱")
    private String email;

    /** 原始密码，保留用户输入，不通过去除空白放宽密码校验。 */
    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 20, message = "密码需为 8—20 位")
    @Pattern(
            regexp = "(?U)(?=.*[a-zA-Z])(?=.*[0-9])[^\\s\\p{Z}]+",
            message = "密码需包含字母和数字，且不能包含空白字符")
    private String password;

    public LoginDTO(String email, String password) {
        setEmail(email);
        this.password = password;
    }

    public void setEmail(String email) {
        this.email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
