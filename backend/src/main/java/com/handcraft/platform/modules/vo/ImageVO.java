package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/** @param id 私有图片编号 @param url 短时读取地址，不写入数据库 @param expiresAt 访问地址失效时间 */
public record ImageVO(String id,String url,OffsetDateTime expiresAt) {}
