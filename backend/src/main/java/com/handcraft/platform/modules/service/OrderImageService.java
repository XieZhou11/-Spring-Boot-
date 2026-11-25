package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.ImageVO;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;

/** 履约、退款和现货快照图片按订单、用途和历史记录授权。 */
public interface OrderImageService {
    /** 本单创作者上传履约实拍图，本单买家上传待开工退款凭证；用途仅PROGRESS或REFUND。 */
    ImageVO upload(Long userId, Long orderId, String purpose, MultipartFile file);

    /** 未绑定仅本人预览，绑定不可变历史记录后订单双方可续签十五分钟。 */
    ImageVO image(Long userId, Long fileId, String purpose);

    /** 为现货订单买卖双方签发订单快照中保存的主图或规格图。 */
    ImageVO stockSnapshot(Long userId, Long orderId, Long fileId);

    /** 上游已持用户、需求、订单锁；按文件编号升序锁定并核验本人、订单、用途及可用状态。 */
    void validate(Long userId, Long orderId, String purpose, List<String> imageIds);
}
