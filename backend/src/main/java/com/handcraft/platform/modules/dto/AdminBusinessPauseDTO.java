package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** 管理员统一暂停或恢复用户新业务。 */
@Getter @Setter
public class AdminBusinessPauseDTO {
    /** true 暂停新业务，false 人工恢复。 */ private boolean paused;
    /** 暂停或恢复原因，均需留痕。 */ @NotBlank @Size(max=1000) private String reason;
    /** 暂停时须填写的恢复条件；恢复操作不需要此字段。 */ @Size(max=1000) private String recoveryCondition;
}
