package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
/** 双方追加证据，文字和图片至少一项非空。 */
@Getter @Setter
public class RefundEvidenceDTO {
    /** 提交者范围幂等键。 */ @NotBlank @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]{8,64}") private String requestKey;
    /** 最多五百字可选说明。 */ @NotNull @Size(max=500) private String content="";
    /** 零至三张本人上传的本单退款凭证。 */ @NotNull @Size(max=3) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
}
