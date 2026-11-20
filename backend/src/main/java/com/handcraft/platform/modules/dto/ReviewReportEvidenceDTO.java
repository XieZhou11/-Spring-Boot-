package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** 举报人补充交易证据或交易参与方提交处置异议。 */
@Getter @Setter
public class ReviewReportEvidenceDTO {
    /** 补充说明或异议内容。 */ @Size(max=1000) private String content;
    /** 本人上传的证据图片编号。 */ @NotNull @Size(max=6) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
}
