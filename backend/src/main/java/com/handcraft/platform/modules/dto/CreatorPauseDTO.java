package com.handcraft.platform.modules.dto;

import lombok.Getter;
import lombok.Setter;

/** 创作者本人设置接单暂停状态。 */
@Getter @Setter
public class CreatorPauseDTO {
    /** true 暂停新接单，false 恢复接单。 */ private boolean paused;
}
