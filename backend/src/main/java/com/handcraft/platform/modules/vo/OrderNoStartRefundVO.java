package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.List;
/** @param id 退款申请编号
 * @param description 原申请说明
 * @param imageIds 原申请凭证编号
 * @param amount 原成功支付对应全额退款金额
 * @param flowNo 原成功退款流水号
 * @param occurredAt 原退款执行时刻
 * @param decisionReason 系统核验依据 */
public record OrderNoStartRefundVO(String id,String description,List<String> imageIds,String amount,String flowNo,OffsetDateTime occurredAt,String decisionReason){}
