package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.web.multipart.MultipartFile;

/** 报价私有图片按上传归属和历史业务关系授权。 */
public interface QuoteImageService {
    /** 已认证且未暂停的创作者上传效果图或草图，失败保留可重试补偿。 */
    ImageVO upload(Long userId, MultipartFile file);

    /** 临时图仅上传者可读，提交后报价及订单双方可续签历史图片。 */
    ImageVO image(Long userId, Long fileId);
}
