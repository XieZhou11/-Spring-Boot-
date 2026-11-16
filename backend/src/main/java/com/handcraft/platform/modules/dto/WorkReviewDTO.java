package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 管理员审核决定与必要原因。 */
@Getter @Setter
public class WorkReviewDTO extends WorkVersionDTO {
    /** APPROVED通过或REJECTED驳回。 */
    @NotBlank @Pattern(regexp="APPROVED|REJECTED") private String decision;
    /** 驳回时必须填写，最多1000字。 */
    @NotNull @Size(max=1000) private String reason="";
}
