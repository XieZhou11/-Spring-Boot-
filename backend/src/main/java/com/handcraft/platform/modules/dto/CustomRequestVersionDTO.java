package com.handcraft.platform.modules.dto;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 需求关闭操作的版本条件。 */
@Getter @Setter
public class CustomRequestVersionDTO {
    /** 当前需求版本。 */
    @NotNull @PositiveOrZero private Long version;
}
