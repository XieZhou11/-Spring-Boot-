package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 管理员对评价举报的处理结论。 */
@Getter @Setter
public class AdminReviewReportDecisionDTO {
    /** 不成立、隐藏违规评价或删除违规评价。 */
    @NotBlank @Pattern(regexp="NOT_UPHELD|HIDE|DELETE|RESTORE") private String decision;
    /** 本次核查依据。 */
    @NotBlank @Size(max=500) private String reason;
}
