package com.handcraft.platform.modules.vo;

/**
 * @param certificationStatus 账号认证状态
 * @param currentApplicationId 最新申请编号，可为空
 * @param approvedApplicationId 已通过申请编号，可为空
 */
public record CreatorCertificationVO(
    String certificationStatus,
    String currentApplicationId,
    String approvedApplicationId) {}
