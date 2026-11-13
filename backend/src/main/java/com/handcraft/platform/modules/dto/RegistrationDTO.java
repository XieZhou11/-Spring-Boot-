package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Locale;

/** 注册参数，仅接收用户可设置字段，不生成包含密码或验证码的 toString。 */
@Getter
@Setter
@NoArgsConstructor
public class RegistrationDTO {

    /** 登录邮箱，去除首尾空白并转小写后校验，仅支持 QQ 和 163 邮箱。 */
    @NotBlank(message = "邮箱不能为空")
    @Size(max = 254, message = "邮箱长度不能超过 254 个字符")
    @Email(message = "请输入正确的邮箱地址")
    @Pattern(regexp = "[^\\s@]+@(qq\\.com|163\\.com)", message = "仅支持 QQ 邮箱和 163 邮箱")
    private String email;

    /** 邮件中的最新六位验证码，注册成功时在账号事务内消费。 */
    @NotBlank(message = "验证码不能为空")
    @Pattern(regexp = "[0-9]{6}", message = "验证码必须为六位数字")
    private String verificationCode;

    /** 原始密码，不去除空白；需为 8—20 位且同时包含字母和数字。 */
    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 20, message = "密码需为 8—20 位")
    @Pattern(
            regexp = "(?U)(?=.*[a-zA-Z])(?=.*[0-9])[^\\s\\p{Z}]+",
            message = "密码需包含字母和数字，且不能包含空白字符")
    private String password;

    /** 昵称，去除首尾空白后为 2—8 个 Unicode 字符，不允许纯符号或脚本标记。 */
    @NotBlank(message = "昵称不能为空")
    // 正则按 Unicode 字符计数，避免 @Size 按 UTF-16 长度误拒绝扩展汉字。
    @Pattern(regexp = "(?s).{2,8}", message = "昵称需为 2—8 字")
    @Pattern(regexp = "(?s).*?[\\p{L}\\p{N}].*", message = "昵称不能为纯符号")
    @Pattern(regexp = "[^<>\\p{Cc}]*", message = "昵称不能包含脚本标记或控制字符")
    private String nickname;

    public RegistrationDTO(
            String email, String verificationCode, String password, String nickname) {
        setEmail(email);
        this.verificationCode = verificationCode;
        this.password = password;
        setNickname(nickname);
    }

    public void setEmail(String email) {
        this.email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    public void setNickname(String nickname) {
        this.nickname = nickname == null ? null : nickname.strip();
    }
}
