package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.List;
/** @param id 记录编号
 * @param requestKey 原请求键，供未知结果核验
 * @param recordType 首次打卡、跳过或补充
 * @param content 原始说明
 * @param imageIds 按原顺序保存的私有图片编号
 * @param skipReason 跳过原因
 * @param createdAt 原提交时刻 */
public record OrderProgressRecordVO(String id,String requestKey,String recordType,String content,List<String> imageIds,String skipReason,OffsetDateTime createdAt){}
