package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

/** 买家通过订单页面明确提交的公开授权决定。 */
@Getter @Setter
public class PublicationConsentDecisionDTO {
    /** 只能明确同意或不同意，不接受聊天文字作为授权。 */
    @NotBlank @Pattern(regexp="APPROVED|REJECTED",message="授权决定无效")
    private String decision;
}
