package com.handcraft.platform.modules.vo;

import java.util.List;

/** @param id 品类编号 @param parentId 父一级品类编号，一级为空 @param name 名称 @param enabled 本级启用标记 @param sortOrder 排序值 @param children 二级品类 */
public record CategoryVO(String id,String parentId,String name,boolean enabled,int sortOrder,List<CategoryVO> children,
        /** 是否启用且为可选末级，父品类停用或存在任何二级时一级不可选。 */
        boolean selectableForWork) {}
