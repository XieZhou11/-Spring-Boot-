package com.handcraft.platform.modules.vo;

import java.util.List;
import java.util.Map;

/** 管理员用户详情及近期关联业务摘要。 */
public record AdminUserDetailVO(
        /** 账号基本信息及两类独立暂停状态。 */ Map<String,Object> user,
        /** 该账号在后台可见的作品数量。 */ long workCount,
        /** 该账号发布的公开需求数量。 */ long requestCount,
        /** 作为买家或创作者参与的订单数量。 */ long orderCount,
        /** 最近作品摘要。 */ List<Map<String,Object>> works,
        /** 最近发布的公开需求摘要。 */ List<Map<String,Object>> requests,
        /** 最近订单摘要。 */ List<Map<String,Object>> orders,
        /** 最近暂停及恢复操作记录，含原因和操作时间。 */ List<Map<String,Object>> pauseHistory) {}
