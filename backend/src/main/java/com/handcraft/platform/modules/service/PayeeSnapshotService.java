package com.handcraft.platform.modules.service;

/** 已支付订单的收款快照解析与展示口径：结算校验、脱敏与管理员明文统一出自本服务。 */
public interface PayeeSnapshotService {
    /** 解析快照三键；缺失或损坏即返回空，由调用方决定是否拒绝结算。 */
    PayeeSnapshot parse(String payeeSnapshot);
    /** 只从本单原快照解密后生成脱敏文本，不返回申请编号、姓名原文或编码密文。 */
    String masked(String payeeSnapshot,Long creatorId);
    /** 管理员资金记录使用的解密明文账号。 */
    String plaintextAccount(String payeeSnapshot,Long creatorId);
    /** 快照中的姓名与账号值。 */
    record PayeeSnapshot(String realName,String accountCiphertext,String applicationId) {
        /** 三键齐备才可用于结算。 */
        public boolean valid() { return realName!=null&&!realName.isEmpty()&&accountCiphertext!=null&&!accountCiphertext.isEmpty()&&applicationId!=null&&!applicationId.isEmpty(); }
    }
}
