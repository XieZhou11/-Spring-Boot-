package com.handcraft.platform.modules.exception;

import com.handcraft.platform.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 报价自然日提交额度，与聊天限流独立。 */
public enum QuoteErrorCode implements ErrorCode {
    DAILY_LIMIT;
    public int code(){return 42902;}
    public String message(){return "今日报价提交已达二十次，请明日再试";}
    public HttpStatus httpStatus(){return HttpStatus.TOO_MANY_REQUESTS;}
}
