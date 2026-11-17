package com.handcraft.platform.modules.vo;
import java.util.List;
import java.time.*;
/**
 * @param id 需求编号
 * @param buyerNickname 买家昵称
 * @param title 标题
 * @param categoryId 末级品类编号
 * @param categoryPath 品类名称路径
 * @param purpose 用途
 * @param materialPreference 材质偏好
 * @param specification 尺寸规格
 * @param budgetMin 预算下限十进制金额
 * @param budgetMax 预算上限十进制金额
 * @param expectedShipDate 期望发货日
 * @param referenceImageIds 参考图编号
 * @param description 需求描述
 * @param visibility 公开或定向范围
 * @param invitedCreatorId 唯一受邀者编号
 * @param invitedCreatorNickname 唯一受邀者昵称
 * @param sourceWorkId 参考作品编号
 * @param status 按服务器时间计算的有效状态
 * @param version 保存版本
 * @param publishedAt 发布时间
 * @param noQuoteExpireAt 无有效报价时的期限
 * @param closedAt 关闭时间
 * @param createdAt 创建时间
 * @param updatedAt 更新时间
 * @param owned 是否本人需求
 * @param canEdit 是否可保存草稿
 * @param canPublish 是否可发布
 * @param canClose 是否可关闭
 * @param canCopy 是否可复制新建
 * @param canConsult 是否可发起或进入会话
 * @param consultationReason 不能发起会话的原因
 * @param canQuote 是否可以提交新报价
 * @param quoteDisabledReason 报价资格、状态或额度限制原因
 */
public record CustomRequestVO(String id,String buyerNickname,String title,String categoryId,List<String> categoryPath,String purpose,String materialPreference,String specification,String budgetMin,String budgetMax,LocalDate expectedShipDate,List<String> referenceImageIds,String description,String visibility,String invitedCreatorId,String invitedCreatorNickname,String sourceWorkId,String status,String version,OffsetDateTime publishedAt,OffsetDateTime noQuoteExpireAt,OffsetDateTime closedAt,OffsetDateTime createdAt,OffsetDateTime updatedAt,boolean owned,boolean canEdit,boolean canPublish,boolean canClose,boolean canCopy,boolean canConsult,String consultationReason,boolean canQuote,String quoteDisabledReason) {}
