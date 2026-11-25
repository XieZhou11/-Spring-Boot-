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
    /** 暂停新业务时必须给出可据以恢复的具体条件。 */
    @Size(max=1000) private String recoveryCondition;
    /** 核查时看到的最新处置日志编号，首次处置为 0。 */
    @PositiveOrZero private Long expectedHistoryId;
}
