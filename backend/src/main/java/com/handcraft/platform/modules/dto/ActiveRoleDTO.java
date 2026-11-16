package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 当前设备的默认入口选择，不赋予新权限。 */
@Getter @Setter
public class ActiveRoleDTO {
    /** 买家或已认证创作者身份。 */
    @NotBlank @Pattern(regexp="BUYER|CREATOR",message="身份选择无效") private String activeRole;
}
