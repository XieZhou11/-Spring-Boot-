package com.handcraft.platform.modules.vo;

/**
 * 仅向地址所属用户返回的收货资料。
 * @param id 字符串地址编号
 * @param recipientName 收件人姓名
 * @param phone 收货手机号
 * @param province 省级地区名称
 * @param city 市级地区名称
 * @param district 区县名称
 * @param detailAddress 详细收货地址
 * @param isDefault 是否默认收货地址
 */
public record AddressVO(String id, String recipientName, String phone, String province,
                        String city, String district, String detailAddress, boolean isDefault) {}
