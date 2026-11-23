package com.handcraft.platform.modules.vo;

/** 更新后的账号业务资格状态。 */
public record AdminUserBusinessVO(
        /** 账号编号。 */ String userId,
        /** 后台暂停新业务状态。 */ boolean adminBusinessPaused,
        /** 创作者本人暂停接单状态。 */ boolean creatorPaused) {}
