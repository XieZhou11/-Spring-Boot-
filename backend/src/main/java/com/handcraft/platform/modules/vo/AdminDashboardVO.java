package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.Map;

/** 后台基础数据看板快照。 */
public record AdminDashboardVO(
        /** 查询完成时间，使用北京时间偏移。 */ OffsetDateTime updatedAt,
        /** 注册账号总数。 */ long userTotal,
        /** 所选日期范围内新增注册账号数。 */ long newUsers,
        /** 当前认证通过账号数。 */ long certifiedCreators,
        /** 所选日期范围内新通过认证的账号数。 */ long newCertifiedCreators,
        /** 各审核状态作品数。 */ Map<String,Long> works,
        /** 各业务状态需求数。 */ Map<String,Long> requests,
        /** 按现货/定制及订单状态统计的数量。 */ Map<String,Long> orders,
        /** 成功模拟支付金额。 */ String paymentAmount,
        /** 成功全额退款金额。 */ String refundAmount,
        /** 当前待结算金额。 */ String pendingSettlementAmount,
        /** 成功模拟结算金额。 */ String settledAmount,
        /** 待办数，按类别区分。 */ Map<String,Long> todos,
        /** 新增统计起始日期，无筛选时为空。 */ String from,
        /** 新增统计结束日期，无筛选时为空。 */ String to) {}
