package com.handcraft.platform.modules.vo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** @param id 节点编号
 * @param nodeCode 固定节点标识
 * @param sortOrder 固定处理顺序
 * @param plannedFinishDate 支付时固定的自然日参考完成日期
 * @param status 当前节点状态
 * @param handledAt 实际打卡或跳过时间
 * @param records 不可覆盖的原图文和追加历史
 * @param canCheckIn 创作者是否可首次打卡
 * @param canSkip 创作者是否可跳过本打样节点
 * @param canSupplement 创作者是否可追加图文
 * @param deviationDays 相对初始计划有符号自然日偏差，提前为负
 * @param overdue 尚未处理且已过计划日 */
public record OrderProgressNodeVO(String id,String nodeCode,Integer sortOrder,LocalDate plannedFinishDate,String status,OffsetDateTime handledAt,List<OrderProgressRecordVO> records,boolean canCheckIn,boolean canSkip,boolean canSupplement,long deviationDays,boolean overdue) {}
