package com.handcraft.platform.modules.dto;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 图文消息允许纯图片，内容治理和归属由服务层校验。 */
@Getter @Setter
public class ChatMessageDTO {
    /** 发送账号范围内UUID幂等键。 */
    @NotBlank @Pattern(regexp="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}") private String clientMessageKey;
    /** 可空文字，纯图片时允许为空。 */
    @Size(max=500) private String content;
    /** 当前会话中本人上传的零至三张图片。 */
    @NotNull @Size(max=3) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
    /** 选填本会话关联订单的制作节点；引用不能代替消息文字或图片。 */
    @Pattern(regexp="[1-9][0-9]{0,18}") private String referencedNodeId;
}
