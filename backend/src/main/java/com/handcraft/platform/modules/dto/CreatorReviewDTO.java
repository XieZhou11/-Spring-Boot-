package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 结论仅可由当前有资格的管理员提交，不能客户端指定审核人。 */
@Getter @Setter
public class CreatorReviewDTO {
    /** 本次结论，通过或驳回。 */
    @NotBlank @Pattern(regexp="APPROVED|REJECTED",message="审核结论无效") private String decision;
    /** 审核说明，驳回时由服务层强制非空。 */
    @Pattern(regexp="(?s)[^<>]*",message="审核说明不能包含脚本标记") private String reason="";
    public void setReason(String value){reason=value==null?"":value.strip();}
}
