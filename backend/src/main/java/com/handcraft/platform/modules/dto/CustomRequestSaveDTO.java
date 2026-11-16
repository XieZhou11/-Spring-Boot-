package com.handcraft.platform.modules.dto;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 需求草稿写入请求。 */
@Getter @Setter
public class CustomRequestSaveDTO extends CustomRequestFieldsDTO {
    /** 当前草稿版本，拒绝过期覆盖。 */
    @NotNull @PositiveOrZero private Long version;
}
