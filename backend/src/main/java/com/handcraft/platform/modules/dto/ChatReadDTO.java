package com.handcraft.platform.modules.dto;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 会话已读游标请求。 */
@Getter @Setter
public class ChatReadDTO {
    /** 已实际展示的最高消息序号，只向前推进。 */
    @NotNull @PositiveOrZero private Long lastReadSeq;
}
