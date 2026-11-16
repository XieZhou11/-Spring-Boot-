package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 品类维护参数；层级仅在创建时指定。 */
@Getter @Setter
public class CategoryDTO {
    /** 父一级品类编号，创建一级时不传；编辑不允许改变。 */
    @Pattern(regexp="[1-9][0-9]{0,18}",message="父品类编号无效")
    private String parentId;
    /** 品类名称，与数据库字段容量一致。 */
    @NotBlank(message="请填写品类名称")
    @Size(max=50,message="品类名称最多50字")
    @Pattern(regexp="(?=.*[\\p{L}\\p{N}])[^<>\\p{Cc}]*",message="品类名称需含文字或数字，不能包含脚本或控制字符")
    private String name;
    /** 当前品类是否启用，不覆盖子品类原有选择。 */
    @NotNull(message="请选择启用状态")
    private Boolean enabled;
    /** 同级显示顺序，越小越靠前。 */
    @NotNull(message="请填写显示顺序")
    private Integer sortOrder;
    public void setName(String value){name=value==null?null:value.strip();}
}
