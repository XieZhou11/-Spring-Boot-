package com.handcraft.platform.modules.vo;

/**
 * @param id 申请编号
 * @param userId 申请人编号
 * @param nickname 申请人昵称
 * @param status 申请状态
 * @param realName 本人及必要管理员可见的姓名
 * @param contactPhone 联系手机号
 * @param province 省级地区
 * @param city 市级地区
 * @param district 区县
 * @param categoryIds 申请的一级主品类编号
 * @param categories 含历史停用品类的名称及状态
 * @param experienceYears 从业年限
 * @param introduction 创作者介绍
 * @param originalWorks 成品与过程图片编号
 * @param alipayAccount 仅本人及审核管理员可见的支付宝账号
 * @param payeeName 与申请人一致的收款人姓名
 * @param supportingDescription 文字补充说明
 * @param reviewerId 审核管理员编号
 * @param reviewReason 审核理由
 * @param submittedAt 提交时间
 * @param reviewedAt 审核时间
 * @param withdrawnAt 撤回时间
 * @param previousApplicationId 同一申请人上一份申请编号
 */
public record CreatorApplicationVO(
    String id,
    String userId,
    String nickname,
    String status,
    String realName,
    String contactPhone,
    String province,
    String city,
    String district,
    java.util.List<String> categoryIds,
    java.util.List<CategoryVO> categories,
    Integer experienceYears,
    String introduction,
    java.util.List<CreatorWorkVO> originalWorks,
    String alipayAccount,
    String payeeName,
    String supportingDescription,
    String reviewerId,
    String reviewReason,
    java.time.OffsetDateTime submittedAt,
    java.time.OffsetDateTime reviewedAt,
    java.time.OffsetDateTime withdrawnAt,
    String previousApplicationId) {}
