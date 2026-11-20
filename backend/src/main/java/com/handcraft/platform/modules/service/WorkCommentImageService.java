package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.web.multipart.MultipartFile;

/** 仅处理作品评论用途的私有图片，不接受其他业务文件引用。 */
public interface WorkCommentImageService {
    /** 校验真实格式及大小，上传本人临时评论图片并返回短时预览签名。 */
    ImageVO upload(Long userId, MultipartFile file);

    /** 核验上传归属或公开评论引用后签发访问地址。 */
    ImageVO view(Long userId, Long fileId);

    /** 举报人、交易参与方和管理员按举报关系读取私有评价举报证据。 */
    ImageVO viewReview(Long userId, Long fileId);
}
