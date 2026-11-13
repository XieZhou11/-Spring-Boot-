package com.handcraft.platform.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/** OSS 私有存储配置；不生成 toString，防止凭据进入日志。未配置不影响其他业务启动。 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.oss")
public class OssProperties {
    /** Bucket 所在地域的 OSS Endpoint。 */
    private String endpoint;
    /** 签名地域，例如 cn-hangzhou。 */
    private String region;
    /** 仅由服务端使用的私有 Bucket 名称。 */
    private String bucket;
    /** 具备本 Bucket 最小读写权限的访问密钥编号。 */
    private String accessKeyId;
    /** 访问密钥秘密，不记录、不返回客户端。 */
    private String accessKeySecret;

    /** 所有必需项齐全才启用真实客户端，不为缺失配置填充假值。 */
    public boolean configured() {
        return StringUtils.hasText(endpoint) && StringUtils.hasText(region) && StringUtils.hasText(bucket)
                && StringUtils.hasText(accessKeyId) && StringUtils.hasText(accessKeySecret);
    }
}
