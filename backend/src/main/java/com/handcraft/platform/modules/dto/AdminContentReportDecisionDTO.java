package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 管理员对作品、评论或创作者主页举报的处理结论。 */
@Getter @Setter
public class AdminContentReportDecisionDTO {
    /** 不成立；下架作品、隐藏评论、暂停新业务；更正阶段可恢复对应内容或新业务。 */
    @NotBlank @Pattern(regexp="NOT_UPHELD|OFFLINE|HIDE|PAUSE|RESTORE|RESUME") private String decision;
    /** 本次核查依据。 */
    @NotBlank @Size(max=500) private String reason;
}
