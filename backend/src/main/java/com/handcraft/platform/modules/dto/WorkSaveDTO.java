package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 保存及提交携带页面读取的版本，避免覆盖其他操作。 */
@Getter @Setter
public class WorkSaveDTO extends WorkFieldsDTO {
    /** 页面读取的作品版本号。 */
    @NotNull @PositiveOrZero private Long version;
}
