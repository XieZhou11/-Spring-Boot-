package com.handcraft.platform.modules.vo;

/**
 * @param finishedImageIds 成品图片编号
 * @param processImageIds 制作过程图片编号
 */
public record CreatorWorkVO(
    java.util.List<String> finishedImageIds,
    java.util.List<String> processImageIds) {}
