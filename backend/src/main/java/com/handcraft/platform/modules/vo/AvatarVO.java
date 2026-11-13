package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/** 本人头像的短时私有访问凭证，不持久化到数据库。 */
public record AvatarVO(
        /** 已完成身份和归属校验的私有图片签名 URL。 */
        String url,
        /** 本次签名到期时间，客户端可据此重新读取个人资料。 */
        OffsetDateTime expiresAt) {}
