package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.*;
/** @param application 申请原文和服务器结果，管理员无参与方操作资格 @param order 独立只读查证资料
 * @param history 相关订单及申请历史 @param canDecide 当前是否允许管理员裁定 @param serverTime 查证快照时刻
 * @param decisionFacts 原终局完整裁定输入，用于未知响应精确核验 */
public record AdminRefundDetailVO(RefundApplicationVO application,AdminRefundOrderVO order,List<AdminRefundHistoryVO> history,boolean canDecide,OffsetDateTime serverTime,Map<String,Object> decisionFacts) {}
