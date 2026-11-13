package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.AvatarVO;
import org.springframework.web.multipart.MultipartFile;

/** 本人头像上传、绑定与私有读取；身份编号必须来自服务端会话。 */
public interface AvatarService {
    /** 校验并真实上传 JPEG/PNG，短事务绑定本人头像；失败保留原头像并补偿新对象。 */
    void upload(Long userId, MultipartFile file);

    /** 核验本人当前头像引用并签发短时访问地址；缺配置或无可用头像返回 null。 */
    AvatarVO view(Long userId, Long fileId);
}
