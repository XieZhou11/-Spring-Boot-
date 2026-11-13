package com.handcraft.platform.config;

import com.aliyun.oss.ClientBuilderConfiguration;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.common.auth.DefaultCredentialProvider;
import com.aliyun.oss.common.comm.SignVersion;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 使用官方 SDK 与 V4 签名；缺配置时不创建客户端，头像上传明确返回服务不可用。 */
@Configuration
@EnableConfigurationProperties(OssProperties.class)
public class OssConfig {
    @Bean(destroyMethod = "shutdown")
    OSS ossClient(OssProperties properties) {
        if (!properties.configured()) return null;
        var configuration = new ClientBuilderConfiguration();
        configuration.setSignatureVersion(SignVersion.V4);
        configuration.setConnectionTimeout(5_000);
        configuration.setConnectionRequestTimeout(5_000);
        configuration.setSocketTimeout(20_000);
        configuration.setRequestTimeout(30_000);
        configuration.setRequestTimeoutEnabled(true);
        // PUT 结果未知时由持久化补偿管理，避免 SDK 隐式重试扩大并发窗口。
        configuration.setMaxErrorRetry(0);
        return OSSClientBuilder.create().endpoint(properties.getEndpoint()).region(properties.getRegion())
                .credentialsProvider(new DefaultCredentialProvider(properties.getAccessKeyId(), properties.getAccessKeySecret()))
                .clientConfiguration(configuration).build();
    }
}
