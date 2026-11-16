package com.handcraft.platform.modules.service;

/** 重要业务动作的追加历史，与调用方事务一致。 */
public interface OperationLogService {
    /** 保存不含个人材料的状态、原因及对象引用；不另启事务。 */
    void record(Long operatorId,boolean admin,String targetType,Long targetId,String action,String before,String after,String reason);
    /** 作品历史保存必要前后值及不可变内容快照；保持原接口兼容。 */
    void record(Long operatorId,boolean admin,String targetType,Long targetId,String action,String before,String after,String reason,java.util.Map<String,Object> detail);
}
