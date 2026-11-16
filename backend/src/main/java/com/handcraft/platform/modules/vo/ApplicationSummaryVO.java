package com.handcraft.platform.modules.vo;

/**
 * @param id 申请编号
 * @param userId 申请人编号
 * @param nickname 申请人昵称
 * @param status 申请状态
 * @param submittedAt 提交时间
 * @param reviewReason 审核理由
 * @param reviewedAt 审核时间
 * @param withdrawnAt 撤回时间
 */
public record ApplicationSummaryVO(
    String id,
    String userId,
    String nickname,
    String status,
    java.time.OffsetDateTime submittedAt,
    String reviewReason,
    java.time.OffsetDateTime reviewedAt,
    java.time.OffsetDateTime withdrawnAt) {}
