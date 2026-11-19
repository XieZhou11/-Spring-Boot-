package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 第五节点图文与运单号须同时提交。 */
@Getter @Setter
public class OrderShipmentDTO extends OrderCheckInDTO {
    /** 八至三十位字母数字运单号。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9]{8,30}") private String trackingNo;
}
