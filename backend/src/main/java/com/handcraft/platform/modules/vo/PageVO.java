package com.handcraft.platform.modules.vo;

import java.util.List;

/** @param items 当前页记录 @param total 总记录数 @param page 从1开始的页码 @param size 每页数量 */
public record PageVO<T>(List<T> items,long total,int page,int size) {}
