package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;
/** 管理员资金记录查询：按结算状态与订单号筛选。 */
@Getter @Setter
public class AdminSettlementQueryDTO {
    /** 结算状态或ALL。 */ @Pattern(regexp="PENDING|SETTLED|CANCELLED|ALL") private String status="ALL";
    /** 按字面包含匹配的订单号。 */ @Size(max=32) private String orderNo;
    /** 结算记录创建时间下限。 */ @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) private LocalDateTime createdFrom;
    /** 结算记录创建时间上限。 */ @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) private LocalDateTime createdTo;
    /** 实付金额下限。 */ @DecimalMin("0.00") @Digits(integer=10,fraction=2) private BigDecimal minAmount;
    /** 实付金额上限。 */ @DecimalMin("0.00") @Digits(integer=10,fraction=2) private BigDecimal maxAmount;
    /** 起始页为一。 */ @Min(1) @Max(1000000) private int page=1;
    /** 每页最多五十条。 */ @Min(1) @Max(50) private int size=20;
    /** 时间和金额范围有效。 */ @AssertTrue(message="时间和金额范围不合法") public boolean isRangeValid(){return (createdFrom==null||createdTo==null||!createdFrom.isAfter(createdTo))&&(minAmount==null||maxAmount==null||minAmount.compareTo(maxAmount)<=0);}
}
