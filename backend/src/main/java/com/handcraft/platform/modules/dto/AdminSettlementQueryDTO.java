package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 管理员资金记录查询：按结算状态与订单号筛选。 */
@Getter @Setter
public class AdminSettlementQueryDTO {
    /** 结算状态或ALL。 */ @Pattern(regexp="PENDING|SETTLED|CANCELLED|ALL") private String status="ALL";
    /** 按字面包含匹配的订单号。 */ @Size(max=32) private String orderNo;
    /** 起始页为一。 */ @Min(1) @Max(1000000) private int page=1;
    /** 每页最多五十条。 */ @Min(1) @Max(50) private int size=20;
}
