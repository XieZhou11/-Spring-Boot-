package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.exception.OnboardingErrorCode;
import com.handcraft.platform.modules.service.PaymentAccountCryptoService;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** 版本1：[1字节版本][12字节随机nonce][密文及128位认证标签]；归属用户作为AAD。 */
@Service
public class PaymentAccountCryptoServiceImpl implements PaymentAccountCryptoService {
    private final String configuredKey;
    private final SecureRandom random=new SecureRandom();
    public PaymentAccountCryptoServiceImpl(@Value("${app.security.payment-account-key:}")String key){this.configuredKey=key;}
    public byte[] encrypt(Long userId,String account){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"收款资料加密",userId,()->{
        try {
            byte[] nonce=new byte[12];random.nextBytes(nonce);Cipher cipher=cipher(Cipher.ENCRYPT_MODE,userId,nonce);
            byte[] encrypted=cipher.doFinal(account.getBytes(StandardCharsets.UTF_8));
            return ByteBuffer.allocate(13+encrypted.length).put((byte)1).put(nonce).put(encrypted).array();
        }catch(Exception e){LoggerFactory.getLogger(getClass()).error("收款资料加密异常：stage=加密处理, userId={}",userId,SafeLog.exception(e));throw new BusinessException(OnboardingErrorCode.PAYMENT_KEY_UNAVAILABLE);}
    });}
    public String decrypt(Long userId,byte[] value){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"收款资料解密",userId,()->{
        try {
            if(value==null||value.length<29||value[0]!=1)throw new IllegalArgumentException();
            ByteBuffer bytes=ByteBuffer.wrap(value);bytes.get();byte[] nonce=new byte[12];bytes.get(nonce);byte[] encrypted=new byte[bytes.remaining()];bytes.get(encrypted);
            return new String(cipher(Cipher.DECRYPT_MODE,userId,nonce).doFinal(encrypted),StandardCharsets.UTF_8);
        }catch(Exception e){LoggerFactory.getLogger(getClass()).error("收款资料解密异常：stage=认证与解密, userId={}",userId,SafeLog.exception(e));throw new BusinessException(OnboardingErrorCode.PAYMENT_KEY_UNAVAILABLE);}
    });}
    private Cipher cipher(int mode,Long userId,byte[] nonce)throws Exception {
        byte[] key=Base64.getDecoder().decode(configuredKey);
        if(key.length!=32)throw new IllegalArgumentException();
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(mode,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,nonce));
        cipher.updateAAD(("creator-application:"+userId).getBytes(StandardCharsets.UTF_8));return cipher;
    }
}
