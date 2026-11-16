package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.web.multipart.MultipartFile;
/** 需求参考图与会话图的私有上传、续签与归属校验。 */
public interface CustomRequestImageService {
    /** 上传本人需求参考图，解码并存入私有OSS。 */
    ImageVO uploadRequest(Long userId,MultipartFile file);
    /** 按上传归属或可访问需求签名读取参考图。 */
    ImageVO requestImage(Long userId,Long fileId);
    /** 上传可发送会话中的本人图片；归档会话不能新增图片。 */
    ImageVO uploadConversation(Long userId,Long conversationId,MultipartFile file);
    /** 会话参与方可读取本人临时图片及本会话已发送的历史图片，并续签私有地址。 */
    ImageVO conversationImage(Long userId,Long fileId);
}
