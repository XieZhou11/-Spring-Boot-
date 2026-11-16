package com.handcraft.platform.modules.exception;
import com.handcraft.platform.common.exception.*;
import org.springframework.http.HttpStatus;
/** 可预期的发送冷却；业务事务不回滚，响应携带剩余冷却秒数。 */
public class ChatRateLimitException extends BusinessException {
    private static final ErrorCode CODE=new ErrorCode(){public int code(){return 42907;}public String message(){return "消息发送过于频繁，请稍后再试";}public HttpStatus httpStatus(){return HttpStatus.TOO_MANY_REQUESTS;}};
    private final int retryAfter;
    public ChatRateLimitException(int retryAfter){super(CODE);this.retryAfter=retryAfter;}
    public int retryAfter(){return retryAfter;}
}
