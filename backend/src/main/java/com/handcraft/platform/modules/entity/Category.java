package com.handcraft.platform.modules.entity;

import lombok.Getter;
import lombok.Setter;

/** 平台两级品类，停用保留历史。 */
@Getter @Setter
public class Category {
    /** 品类编号。 */
    private Long id;
    /** 父一级编号，一级为空。 */
    private Long parentId;
    /** 品类名称。 */
    private String name;
    /** 本级启用状态。 */
    private boolean enabled;
    /** 同级排序。 */
    private Integer sortOrder;
}
