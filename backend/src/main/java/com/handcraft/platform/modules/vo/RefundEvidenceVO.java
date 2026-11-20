package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.List;
/** @param id 证据编号 @param refundApplicationId 所属申请 @param submitterId 提交者 @param content 补充说明 @param imageIds 图片文件编号 @param requestKey 原提交幂等键 @param createdAt 服务器提交时间 */
public record RefundEvidenceVO(String id,String refundApplicationId,String submitterId,String content,List<String> imageIds,String requestKey,OffsetDateTime createdAt) {}
