package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 订单只按当前账号的真实交易关系筛选。 */
@Getter @Setter
public class OrderQueryDTO {
    /** 页码，从一开始。 */
    @Min(1) @Max(1000000) private int page=1;
    /** 每页数量。 */
    @Min(1) @Max(50) private int size=20;
    /** 订单完整履约状态筛选。 */
    @Pattern(regexp="ALL|PENDING_PAY|PAID|IN_PRODUCTION|PENDING_SHIP|SHIPPED|COMPLETED|AFTER_SALE|REFUNDED|CANCELLED") private String status="ALL";
    /** 买入或承接关系，与界面身份无关。 */
    @NotNull @Pattern(regexp="BUYER|CREATOR") private String side="BUYER";
}
