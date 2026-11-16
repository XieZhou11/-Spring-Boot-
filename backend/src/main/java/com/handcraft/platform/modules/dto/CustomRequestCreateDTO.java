package com.handcraft.platform.modules.dto;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 需求草稿写入请求。 */
@Getter @Setter
public class CustomRequestCreateDTO extends CustomRequestFieldsDTO {
    /** 买家范围的创建重试键。 */
    @NotBlank @Pattern(regexp="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}") private String requestKey;
}
