package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** 买家对已完成订单的评价内容。 */
@Getter @Setter
public class OrderReviewDTO {
    /** 对订单体验的总体评分。 */
    @NotNull @Min(1) @Max(5) private Integer rating;
    /** 必填评价文字，实际 Unicode 字符数由服务层校验。 */
    @NotBlank @Size(max=1000) private String content;
    /** 本人已上传的评价图片编号，最多三张，每个编号为 1 至 18 位正整数字符串。 */
    @NotNull
    @Size(max = 3)
    private List<@NotBlank @Pattern(regexp = "[1-9][0-9]{0,17}",
            message = "图片编号须为 1–18 位正整数字符串") String> imageIds = List.of();
}
