package com.handcraft.platform.modules.dto;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 草稿允许不完整，格式及上限仍统一校验。 */
@Getter @Setter
public class CustomRequestFieldsDTO {
    /** 需求标题。 */
    @Size(max=30,message="标题最多30字")
    private String title;
    /** 末级品类字符串编号。 */
    @Pattern(regexp="[1-9][0-9]{0,18}")
    private String categoryId;
    /** 用途说明。 */
    @Size(max=10000)
    private String purpose;
    /** 材质偏好，可注明无特殊要求。 */
    @Size(max=10000)
    private String materialPreference;
    /** 尺寸或规格说明。 */
    @Size(max=10000)
    private String specification;
    /** 预算下限，单位元。 */
    @DecimalMin("50.00") @DecimalMax("50000.00") @Digits(integer=5,fraction=2)
    private BigDecimal budgetMin;
    /** 预算上限，单位元。 */
    @DecimalMin("50.00") @DecimalMax("50000.00") @Digits(integer=5,fraction=2)
    private BigDecimal budgetMax;
    /** 期望发货日，不含物流在途时间。 */
    private LocalDate expectedShipDate;
    /** 本人上传的零至九张参考图。 */
    @NotNull @Size(max=9)
    private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> referenceImageIds=List.of();
    /** 需求细节与验收要求。 */
    @Size(max=2000)
    private String description;
    /** 公开PUBLIC或单人定向DIRECTED。 */
    @NotNull @Pattern(regexp="PUBLIC|DIRECTED")
    private String visibility="PUBLIC";
    /** 唯一指定创作者字符串编号。 */
    @Pattern(regexp="[1-9][0-9]{0,18}")
    private String invitedCreatorId;
    /** 仅作为参考、不占现货的来源作品编号。 */
    @Pattern(regexp="[1-9][0-9]{0,18}")
    private String sourceWorkId;
}
