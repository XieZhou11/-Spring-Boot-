package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** 针对作品、作品评论或创作者主页提交违规举报。 */
@Getter @Setter
public class ContentReportDTO {
    /** 盗图、虚假宣传、站外引流、辱骂或其他理由。 */
    @NotBlank @Pattern(regexp="COPYRIGHT|FALSE_ADVERTISING|OFFSITE|ABUSE|OTHER") private String reasonCode;
    /** 举报说明，可仅用图片举证。 */
    @Size(max=1000) private String description;
    /** 本人已上传的举报证据图片编号，最多六张，每个编号为 1 至 18 位正整数字符串。 */
    @NotNull
    @Size(max = 6)
    private List<@NotBlank @Pattern(regexp = "[1-9][0-9]{0,17}",
            message = "图片编号须为 1–18 位正整数字符串") String> imageIds = List.of();
}
