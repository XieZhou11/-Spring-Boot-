package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;
/** 售后队列默认仅展示普通待处理申请。 */
@Getter @Setter
public class AdminRefundQueryDTO {
    /** 申请状态或ALL。 */ @Pattern(regexp="WAIT_ADMIN|REFUNDED|REJECTED|WITHDRAWN|ALL") private String status="WAIT_ADMIN";
    /** 申请类型或ALL。 */ @Pattern(regexp="NORMAL|NO_START_TIMEOUT|ALL") private String applicationType="NORMAL";
    /** 按字面包含匹配的订单号。 */ @Size(max=32) private String orderNo;
    /** 退款申请创建时间下限。 */ @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) private LocalDateTime createdFrom;
    /** 退款申请创建时间上限。 */ @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) private LocalDateTime createdTo;
    /** 订单实付金额下限。 */ @DecimalMin("0.00") @Digits(integer=10,fraction=2) private BigDecimal minAmount;
    /** 订单实付金额上限。 */ @DecimalMin("0.00") @Digits(integer=10,fraction=2) private BigDecimal maxAmount;
    /** 起始页为一。 */ @Min(1) @Max(1000000) private int page=1;
    /** 每页最多五十条。 */ @Min(1) @Max(50) private int size=20;
    /** 时间和金额范围有效。 */ @AssertTrue(message="时间和金额范围不合法") public boolean isRangeValid(){return (createdFrom==null||createdTo==null||!createdFrom.isAfter(createdTo))&&(minAmount==null||maxAmount==null||minAmount.compareTo(maxAmount)<=0);}
}
