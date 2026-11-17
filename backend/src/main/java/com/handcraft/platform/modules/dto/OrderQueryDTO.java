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
    /** 当前实现的待付款与取消状态。 */
    @Pattern(regexp="ALL|PENDING_PAY|CANCELLED") private String status="ALL";
    /** 买入或承接关系，与界面身份无关。 */
    @NotNull @Pattern(regexp="BUYER|CREATOR") private String side="BUYER";
}
