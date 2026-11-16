package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.web.multipart.MultipartFile;

/** 入驻图片独立于头像和公开作品，不能跨用途引用。 */
public interface CreatorImageService {
    /** 校验实际图片并上传私有OSS，失败保留可恢复的文件状态。 */
    ImageVO upload(Long userId,MultipartFile file);
    /** 仅本人或有权查阅关联材料的管理员可取得短时签名。 */
    ImageVO view(Long userId,Long fileId);
}
