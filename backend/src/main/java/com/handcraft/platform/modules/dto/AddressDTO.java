package com.handcraft.platform.modules.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 收货地址写入参数，所属用户始终来自登录身份。 */
@Getter
@Setter
@NoArgsConstructor
public class AddressDTO {
    /** 收件人姓名，最大长度对应当前存储容量，不采集身份证信息。 */
    @NotBlank(message = "请填写收件人")
    @Pattern(regexp = "[^<>\\p{Cc}]{1,50}", message = "收件人最多 50 字，不能包含脚本标记或控制字符")
    private String recipientName;
    /** 大陆 11 位手机号，仅用于收货，不作为登录凭证。 */
    @NotBlank(message = "请填写手机号")
    @Pattern(regexp = "1[3-9][0-9]{9}", message = "请输入正确的大陆 11 位手机号")
    private String phone;
    /** 省级地区名称，允许补充静态数据尚未覆盖的合法地区。 */
    @NotBlank(message = "请填写省份")
    @Pattern(regexp = "[^<>\\p{Cc}]{1,50}", message = "省份最多 50 字，不能包含脚本标记或控制字符")
    private String province;
    /** 市级地区名称。 */
    @NotBlank(message = "请填写城市")
    @Pattern(regexp = "[^<>\\p{Cc}]{1,50}", message = "城市最多 50 字，不能包含脚本标记或控制字符")
    private String city;
    /** 区县名称，与省市一起保存文本，不依赖外部地图服务。 */
    @NotBlank(message = "请填写区县")
    @Pattern(regexp = "[^<>\\p{Cc}]{1,50}", message = "区县最多 50 字，不能包含脚本标记或控制字符")
    private String district;
    /** 街道、门牌等详细地址，不要求邮编。 */
    @NotBlank(message = "请填写详细地址")
    @Pattern(regexp = "[^<>\\p{Cc}]{1,255}", message = "详细地址最多 255 字，不能包含脚本标记或控制字符")
    private String detailAddress;
    /** true 请求设为默认；false 不取消已有默认地址。 */
    @JsonProperty("isDefault")
    private boolean defaultAddress;

    public void setRecipientName(String value) { recipientName = trim(value); }
    public void setPhone(String value) { phone = trim(value); }
    public void setProvince(String value) { province = trim(value); }
    public void setCity(String value) { city = trim(value); }
    public void setDistrict(String value) { district = trim(value); }
    public void setDetailAddress(String value) { detailAddress = trim(value); }
    private static String trim(String value) { return value == null ? null : value.strip(); }
}
