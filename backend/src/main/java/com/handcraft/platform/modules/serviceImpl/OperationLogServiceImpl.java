package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.mapper.OperationLogMapper;
import com.handcraft.platform.modules.service.OperationLogService;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 记录调用业务的最终状态，不以控制台日志替代持久化审核历史。 */
@Service
public class OperationLogServiceImpl implements OperationLogService {
    private final OperationLogMapper logs;
    private final tools.jackson.databind.ObjectMapper json;
    public OperationLogServiceImpl(OperationLogMapper logs,tools.jackson.databind.ObjectMapper json){this.logs=logs;this.json=json;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(Long operatorId,boolean admin,String targetType,Long targetId,String action,String before,String after,String reason,java.util.Map<String,Object> detail){
        BusinessLog.run(LoggerFactory.getLogger(getClass()),"业务内容历史保存",operatorId,()->{
            logs.insertDetail(operatorId,operatorId==null?"SYSTEM":admin?"ADMIN":"USER",targetType,targetId,action,before,after,reason,json.writeValueAsString(detail));
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                @Override public void afterCommit(){LoggerFactory.getLogger(OperationLogServiceImpl.class).info("业务状态变更已提交：operatorId={}, targetId={}, action={}, before={}, after={}",operatorId,targetId,action,before,after);}
            });return null;
        });
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(Long operatorId,boolean admin,String targetType,Long targetId,String action,String before,String after,String reason){
        BusinessLog.run(LoggerFactory.getLogger(getClass()),"操作历史保存",operatorId,()->{
            // 定时到期与自动状态重算没有人工操作者，两种历史入口保持相同的系统身份规则。
            logs.insert(operatorId,operatorId==null?"SYSTEM":admin?"ADMIN":"USER",targetType,targetId,action,before,after,reason);
            // 状态定位信息仅在提交后输出，不记录可能包含个人信息的人工意见。
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                @Override public void afterCommit(){LoggerFactory.getLogger(OperationLogServiceImpl.class).info("业务状态变更：operatorId={}, targetType={}, targetId={}, action={}, before={}, after={}",operatorId,targetType,targetId,action,before,after);}
            });return null;
        });
    }
}
