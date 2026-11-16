package com.handcraft.platform.modules.service;

/** 收款账号的认证加密，只接受服务端确认的归属编号。 */
public interface PaymentAccountCryptoService {
    /** 用随机nonce和用户归属认证数据生成版本化密文。 */
    byte[] encrypt(Long userId,String account);
    /** 校验完整性及归属后解密；失败不降级返回明文或空账户。 */
    String decrypt(Long userId,byte[] value);
}
