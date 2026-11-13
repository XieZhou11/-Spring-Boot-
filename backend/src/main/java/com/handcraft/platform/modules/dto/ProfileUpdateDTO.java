package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 本人可编辑的公开资料；不接收邮箱、角色或认证字段。 */
@Getter
@NoArgsConstructor
public class ProfileUpdateDTO {
    /** 去首尾空白后的昵称，按 Unicode 字符计数，与注册规则一致。 */
    @NotBlank(message = "昵称不能为空")
    @Pattern(regexp = "(?s).{2,8}", message = "昵称需为 2—8 字")
    @Pattern(regexp = "(?s).*?[\\p{L}\\p{N}].*", message = "昵称不能为纯符号")
    @Pattern(regexp = "[^<>\\p{Cc}]*", message = "昵称不能包含脚本标记或控制字符")
    @Pattern(regexp = PUBLIC_TEXT, message = "昵称不能包含辱骂或站外引流内容")
    private String nickname;

    /** 个人简介，保留内部换行；空值统一清空，不渲染为 HTML。 */
    @Pattern(regexp = "(?s).{0,200}", message = "简介最多 200 字")
    @Pattern(regexp = PUBLIC_TEXT, message = "简介不能包含脚本、辱骂或站外引流内容")
    private String bio = "";

    // MVP 明确拦截脚本标签、常见外链、联系方式引导和明显辱骂，不声称穷尽内容审核。
    private static final String PUBLIC_TEXT = "(?is)(?!.*(?:[<>]|https?://|www\\.|javascript:|(?:微信|微.?信|wechat|qq|vx|v信)\\s*[:：号]?\\s*[a-z0-9_-]{5,}|加我|私下交易|淘宝店|拼多多店|傻[逼比]|操你|他妈的|去死)).*";

    public void setNickname(String value) { nickname = value == null ? null : value.strip(); }
    public void setBio(String value) { bio = value == null ? "" : value.strip(); }
}
