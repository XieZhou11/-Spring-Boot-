package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** 针对违规订单评价提交举报及补充证据。 */
@Getter @Setter
public class ReviewReportDTO {
    /** 盗图、虚假宣传、站外引流、辱骂或其他理由。 */
    @NotBlank @Pattern(regexp="COPYRIGHT|FALSE_ADVERTISING|OFFSITE|ABUSE|OTHER") private String reasonCode;
    /** 举报说明，可仅用图片举证。 */
    @Size(max=1000) private String description;
    /** 本人已上传的举报证据图片编号。 */
    @NotNull @Size(max=6) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
}
