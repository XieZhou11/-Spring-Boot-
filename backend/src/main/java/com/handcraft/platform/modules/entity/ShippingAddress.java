package com.handcraft.platform.modules.entity;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 本人地址实体，不生成包含收货资料的 toString。 */
@Getter
@Setter
public class ShippingAddress {
    /** 地址主键。 */
    private Long id;
    /** 所属用户编号。 */
    private Long userId;
    /** 收件人姓名。 */
    private String recipientName;
    /** 收货手机号。 */
    private String phone;
    /** 省级地区名称。 */
    private String province;
    /** 市级地区名称。 */
    private String city;
    /** 区县名称。 */
    private String district;
    /** 详细收货地址。 */
    private String detailAddress;
    /** 是否默认收货地址。 */
    private boolean defaultAddress;
    /** 创建时间，用于删除默认地址后的确定性替换。 */
    private LocalDateTime createdAt;
}
