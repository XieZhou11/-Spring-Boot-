package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import java.util.List;
/** 评论文本与本人已上传图片编号。 */
@Getter @Setter
public class WorkCommentDTO {
 /** 必填评论文字；UTF-16 安全上限1000，实际10至500个Unicode码点由Service校验。 */
 @NotBlank @Size(max=1000)
 private String content;
 /** 最多三张评论用途图片，编号不允许空值或前导零。 */
 @Size(max=3)
 private List<@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds;
}
