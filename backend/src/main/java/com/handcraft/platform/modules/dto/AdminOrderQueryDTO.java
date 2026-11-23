package com.handcraft.platform.modules.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

/** 管理员订单综合检索条件。 */
@Getter @Setter
public class AdminOrderQueryDTO {
    /** 按业务订单号字面包含匹配。 */ @Size(max=32) private String orderNo;
    /** 履约状态或 ALL。 */ @Pattern(regexp="PENDING_PAY|PAID|IN_PRODUCTION|PENDING_SHIP|SHIPPED|COMPLETED|AFTER_SALE|REFUNDED|CANCELLED|ALL") private String status="ALL";
    /** STOCK 现货、CUSTOM 定制或 ALL。 */ @Pattern(regexp="STOCK|CUSTOM|ALL") private String orderType="ALL";
    /** 订单创建时间下限。 */ @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) private LocalDateTime createdFrom;
    /** 订单创建时间上限。 */ @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) private LocalDateTime createdTo;
    /** 成交金额下限。 */ @DecimalMin("0.00") @Digits(integer=10,fraction=2) private BigDecimal minAmount;
    /** 成交金额上限。 */ @DecimalMin("0.00") @Digits(integer=10,fraction=2) private BigDecimal maxAmount;
    /** 起始页码。 */ @Min(1) @Max(1000000) private int page=1;
    /** 每页数量。 */ @Min(1) @Max(50) private int size=20;
    /** 时间与金额上下限成对且范围有效。 */ @AssertTrue(message="时间和金额范围不合法") public boolean isRangeValid(){return (createdFrom==null||createdTo==null||!createdFrom.isAfter(createdTo))&&(minAmount==null||maxAmount==null||minAmount.compareTo(maxAmount)<=0);}
}
