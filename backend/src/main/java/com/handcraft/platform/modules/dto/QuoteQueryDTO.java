package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 报价历史分页与有效状态筛选。 */
@Getter @Setter
public class QuoteQueryDTO {
    /** 页码，从一开始。 */
    @Min(1) @Max(1000000) private int page=1;
    /** 每页数量。 */
    @Min(1) @Max(50) private int size=20;
    /** 按服务器时间判断的报价状态。 */
    @Pattern(regexp="ALL|ACTIVE|AWARDED|LOST|EXPIRED") private String status="ALL";
    /** 本人报价可按所属需求筛选。 */
    @Positive private Long requestId;
}
