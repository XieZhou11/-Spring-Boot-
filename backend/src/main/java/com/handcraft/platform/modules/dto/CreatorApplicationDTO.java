package com.handcraft.platform.modules.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** 入驻请求不接收用户编号、认证状态或管理员字段。 */
@Getter @Setter
public class CreatorApplicationDTO {
    /** 同一申请重试保持不变的UUID键。 */
    @NotBlank @Pattern(regexp="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}",message="提交请求键无效")
    private String requestKey;
    /** 申请人真实姓名，仅本人及必要管理员可见。 */
    @NotBlank(message="请填写姓名") @Pattern(regexp="[^<>\\p{Cc}]{2,20}",message="姓名需为2—20字且不能包含脚本")
    private String realName;
    /** 大陆联系手机号，不作为登录账号。 */
    @NotBlank @Pattern(regexp="1[3-9][0-9]{9}",message="请填写有效大陆手机号")
    private String contactPhone;
    /** 所在省级地区。 */
    @NotBlank @Size(max=50) @Pattern(regexp="[^<>\\p{Cc}]*") private String province;
    /** 所在市级地区。 */
    @NotBlank @Size(max=50) @Pattern(regexp="[^<>\\p{Cc}]*") private String city;
    /** 所在区县。 */
    @NotBlank @Size(max=50) @Pattern(regexp="[^<>\\p{Cc}]*") private String district;
    /** 1—3个启用一级主品类编号。 */
    @NotNull @Size(min=1,max=3,message="请选择1—3个一级主品类")
    private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> categoryIds;
    /** 从业年限，允许零年。 */
    @NotNull @Min(0) @Max(70) private Integer experienceYears;
    /** 创作者介绍，按Unicode字数限制，不渲染HTML。 */
    @NotBlank @Pattern(regexp="(?s).{50,500}",message="介绍需为50—500字")
    @Pattern(regexp=PUBLIC_TEXT,message="介绍不能包含脚本、辱骂或站外引流内容")
    private String introduction;
    /** 3—5件原创作品，每件含成品与过程图片。 */
    @NotNull @Size(min=3,max=5,message="请提交3—5件原创作品") @Valid
    private List<@NotNull @Valid CreatorWorkDTO> originalWorks;
    /** 支付宝手机号或邮箱，保存时加密；不受登录邮箱域名限制。 */
    @NotBlank @Size(max=254)
    @Pattern(regexp="(?:1[3-9][0-9]{9}|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\\.[A-Za-z]{2,})",message="支付宝账号需为有效手机号或邮箱")
    private String alipayAccount;
    /** 收款人姓名，服务层校验与申请人一致。 */
    @NotBlank @Pattern(regexp="[^<>\\p{Cc}]{2,20}") private String payeeName;
    /** 可选文字补充，不采集身份证或证明附件。 */
    @Pattern(regexp=PUBLIC_TEXT,message="补充说明不能包含脚本、辱骂或站外引流内容")
    private String supportingDescription="";
    private static final String PUBLIC_TEXT="(?is)(?!.*(?:[<>]|https?://|www\\.|javascript:|(?:微信|wechat|vx)\\s*[:：号]?\\s*[a-z0-9_-]{5,}|加我|私下交易|傻[逼比]|操你|他妈的|去死)).*";
    public void setRequestKey(String value){requestKey=value==null?null:value.strip().toLowerCase(java.util.Locale.ROOT);}
    public void setRealName(String value){realName=strip(value);}
    public void setPayeeName(String value){payeeName=strip(value);}
    public void setContactPhone(String value){contactPhone=strip(value);}
    public void setProvince(String value){province=strip(value);}
    public void setCity(String value){city=strip(value);}
    public void setDistrict(String value){district=strip(value);}
    public void setAlipayAccount(String value){alipayAccount=strip(value);}
    public void setIntroduction(String value){introduction=strip(value);}
    public void setSupportingDescription(String value){supportingDescription=value==null?"":value.strip();}
    private static String strip(String value){return value==null?null:value.strip();}
}
