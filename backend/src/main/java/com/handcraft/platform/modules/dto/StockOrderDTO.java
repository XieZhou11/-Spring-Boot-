package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** 现货建单只接收请求幂等键与地址编号，价格和快照由服务端读取。 */
@Getter @Setter
public class StockOrderDTO {
    /** 买家范围内的幂等请求键。 */
    @NotBlank @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]{16,64}")
    private String requestKey;
    /** 买家本人已保存的收货地址编号。 */
    @NotBlank @Pattern(regexp="[1-9][0-9]{0,19}")
    private String addressId;
}
