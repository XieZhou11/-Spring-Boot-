package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 创建请求在作者范围内幂等；重试内容取创建快照比较。 */
@Getter @Setter
public class WorkCreateDTO extends WorkFieldsDTO {
    /** 客户端生成并在失败重试时保留的UUID。 */
    @NotBlank @Pattern(regexp="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    private String requestKey;
}
