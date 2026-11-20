package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** 管理员裁定仅接收查阅版本和核验事实，金额及核实人由服务器产生。 */
@Getter @Setter
public class AdminRefundDecisionDTO {
    /** 已完整查阅的补证版本。 */ @NotNull @PositiveOrZero private Long expectedVersion;
    /** 批准或驳回。 */ @NotBlank @Pattern(regexp="APPROVE|REJECT") private String decision;
    /** 必填处理依据。 */ @NotBlank @Size(max=500) private String reason;
    /** 曾发货订单是否需要退回。 */ private Boolean returnRequired;
    /** 管理员是否确认原成品已退回。 */ private Boolean returnedConfirmed;
    /** 选填已核实的退回单号。 */ @Pattern(regexp="[A-Za-z0-9]{8,30}") private String returnTrackingNo;
    /** 只可选择本申请已保存的初始或补充图片。 */ @NotNull @Size(max=50) private List<@NotBlank @Pattern(regexp="[1-9][0-9]*") String> returnEvidenceImageIds=List.of();
    /** 无需退货的处理依据。 */ @Size(max=500) private String noReturnBasis;
}
