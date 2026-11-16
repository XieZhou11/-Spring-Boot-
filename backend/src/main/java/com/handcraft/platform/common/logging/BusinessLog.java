package com.handcraft.platform.common.logging;

import com.handcraft.platform.common.exception.BusinessException;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 统一业务入口日志；事务提交前不报告成功，异常只输出脱敏栈和业务定位编号。 */
public final class BusinessLog {
    private BusinessLog() {}
    public static <T> T run(Logger log, String business, Long userId, Supplier<T> action) {
        log.info("{}开始：userId={}",business,userId);
        try {
            T result=action.get();
            if(TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCommit() { log.info("{}完成：userId={}",business,userId); }
                    @Override public void afterCompletion(int status) {
                        if(status==STATUS_ROLLED_BACK) log.warn("{}失败：stage=事务提交, userId={}, reason=事务回滚",business,userId);
                        else if(status==STATUS_UNKNOWN) log.error("{}失败：stage=事务提交, userId={}, reason=提交结果未知",business,userId);
                    }
                });
            } else log.info("{}完成：userId={}",business,userId);
            return result;
        } catch(BusinessException e) {
            log.warn("{}失败：stage=业务规则与数据处理, userId={}, code={}, reason={}",business,userId,e.getErrorCode().code(),e.getMessage());throw e;
        } catch(RuntimeException e) {
            log.error("{}异常：stage=数据处理, userId={}",business,userId,SafeLog.exception(e));throw e;
        }
    }
}
