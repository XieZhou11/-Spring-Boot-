package com.handcraft.platform.modules.security;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;

/** 单机账号会话登记；销毁监听与到期清理共同防止登记泄漏。 */
@Component
public class AccountSessionRegistry implements HttpSessionListener {
    private record Entry(HttpSession session, AccountPrincipal principal) {}

    private final ConcurrentHashMap<String, Entry> sessions = new ConcurrentHashMap<>();
    private final Clock clock;

    public AccountSessionRegistry(Clock clock) {
        this.clock = clock;
    }

    public void register(HttpSession session, AccountPrincipal principal) {
        sessions.put(session.getId(), new Entry(session, principal));
    }

    public void invalidate(HttpSession session) {
        if (session == null) {
            return;
        }
        try {
            sessions.remove(session.getId());
            session.invalidate();
        } catch (IllegalStateException ignored) {
            // 多个请求或重置同时撤销时，已失效视为完成。
        }
    }

    public void revokeCredentials(Long userId, String previousPasswordHash) {
        sessions.forEach(
                (id, entry) -> {
                    if (entry.principal().userId().equals(userId)
                            && entry.principal().matches(previousPasswordHash)
                            && sessions.remove(id, entry)) {
                        invalidate(entry.session());
                    }
                });
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent event) {
        sessions.remove(event.getSession().getId());
    }

    @Scheduled(fixedDelay = 60000)
    public void removeExpired() {
        sessions.forEach(
                (id, entry) -> {
                    if (!clock.instant().isBefore(entry.principal().expiresAt())
                            && sessions.remove(id, entry)) {
                        invalidate(entry.session());
                    }
                });
    }
}
