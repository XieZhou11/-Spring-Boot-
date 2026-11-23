package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** 后台账号查询筛选及分页。 */
@Getter @Setter
public class AdminUserQueryDTO {
    /** 邮箱包含匹配条件。 */ @Size(max=254) private String email;
    /** 昵称包含匹配条件。 */ @Size(max=8) private String nickname;
    /** 认证状态或 ALL。 */ @Pattern(regexp="NONE|PENDING|APPROVED|REJECTED|ALL") private String certificationStatus="ALL";
    /** 起始页码。 */ @Min(1) @Max(1000000) private int page=1;
    /** 每页数量。 */ @Min(1) @Max(50) private int size=20;
}
