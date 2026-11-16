package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.web.multipart.MultipartFile;
/** 作品私有图片：上传者、公开作品及历史审核范围内鉴权。 */
public interface WorkImageService {
    /** 实际解码JPEG/PNG/WebP并上传私有OSS，失败持久化补偿。 */
    ImageVO upload(Long userId,MultipartFile input);
    /** 核验本人、管理员历史或当前上架作品引用后签发短时URL。 */
    ImageVO view(Long userId,Long fileId);
}
