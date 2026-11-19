package com.handcraft.platform.modules.vo;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** @param id 节点编号
 * @param nodeCode 固定节点标识
 * @param sortOrder 固定处理顺序
 * @param plannedFinishDate 支付时固定的自然日参考完成日期
 * @param status 当前节点状态
 * @param handledAt 实际打卡或跳过时间 */
public record OrderProgressNodeVO(String id,String nodeCode,Integer sortOrder,LocalDate plannedFinishDate,String status,OffsetDateTime handledAt) {}
