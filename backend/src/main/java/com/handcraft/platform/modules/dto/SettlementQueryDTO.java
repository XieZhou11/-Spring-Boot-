package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 创作者收入记录查询：默认展示全部状态。 */
@Getter @Setter
public class SettlementQueryDTO {
    /** 结算状态或ALL。 */ @Pattern(regexp="PENDING|SETTLED|CANCELLED|ALL") private String status="ALL";
    /** 起始页为一。 */ @Min(1) @Max(1000000) private int page=1;
    /** 每页最多五十条。 */ @Min(1) @Max(50) private int size=20;
}
