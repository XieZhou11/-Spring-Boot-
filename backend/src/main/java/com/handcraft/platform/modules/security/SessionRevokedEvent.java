package com.handcraft.platform.modules.security;

/** 会话销毁后关闭关联长连接；会话标识仅用于进程内匹配，不记录日志。 */
public record SessionRevokedEvent(String sessionId) {}
