package com.handcraft.platform.modules.entity;

import lombok.Getter;
import lombok.Setter;

/** 历次认证材料持久化对象，不生成包含个人资料的toString。 */
@Getter @Setter
public class CreatorApplication {
    /** 申请编号。 */
    private Long id;
    /** 申请人编号。 */
    private Long userId;
    /** 提交请求键。 */
    private String requestKey;
    /** 申请人姓名。 */
    private String realName;
    /** 联系手机号。 */
    private String contactPhone;
    /** 省级地区。 */
    private String province;
    /** 市级地区。 */
    private String city;
    /** 区县。 */
    private String district;
    /** 从业年限。 */
    private Integer experienceYears;
    /** 创作者介绍。 */
    private String introduction;
    /** 成品和过程图的JSON引用。 */
    private String originalWorks;
    /** 版本化支付宝账号认证密文。 */
    private byte[] alipayAccountCiphertext;
    /** 文字补充说明。 */
    private String supportingDescription;
    /** 申请状态。 */
    private String status;
    /** 审核管理员编号。 */
    private Long reviewerId;
    /** 审核理由。 */
    private String reviewReason;
    /** 提交时间。 */
    private java.time.LocalDateTime submittedAt;
    /** 审核时间。 */
    private java.time.LocalDateTime reviewedAt;
    /** 撤回时间。 */
    private java.time.LocalDateTime withdrawnAt;
}
