package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** 一件原创作品的成品与过程图片，只有引用归属校验通过才可提交。 */
@Getter @Setter
public class CreatorWorkDTO {
    /** 至少一张本人上传的成品图编号。 */
    @NotEmpty(message="每件作品至少上传一张成品图")
    private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> finishedImageIds;
    /** 至少一张本人上传的制作过程图编号。 */
    @NotEmpty(message="每件作品至少上传一张制作过程图")
    private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> processImageIds;
}
