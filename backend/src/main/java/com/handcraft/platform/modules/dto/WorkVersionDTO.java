package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 状态操作的并发前置条件。 */
@Getter @Setter
public class WorkVersionDTO {
    /** 页面读取的作品版本号。 */
    @NotNull @PositiveOrZero private Long version;
}
