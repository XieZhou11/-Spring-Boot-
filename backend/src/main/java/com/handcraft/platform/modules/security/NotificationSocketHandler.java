package com.handcraft.platform.modules.security;

import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.mapper.*;
import jakarta.servlet.http.HttpSession;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.*;
import tools.jackson.databind.ObjectMapper;

/** 单机多端通知连接；每次收发检查服务端凭证，长连接不能绕过退出、重置或到期。 */
@Component
public class NotificationSocketHandler extends TextWebSocketHandler {
    private static final Logger LOGGER=LoggerFactory.getLogger(NotificationSocketHandler.class);
    private record Connection(WebSocketSession socket,HttpSession session,AccountPrincipal principal) {}
    private final ConcurrentHashMap<String,Connection> connections=new ConcurrentHashMap<>();
    private final UserAccountMapper accounts;
    private final SystemNotificationMapper notices;
    private final ObjectMapper json;
    private final Clock clock;
    public NotificationSocketHandler(UserAccountMapper accounts,SystemNotificationMapper notices,ObjectMapper json,Clock clock){this.accounts=accounts;this.notices=notices;this.json=json;this.clock=clock;}
    @Override public void afterConnectionEstablished(WebSocketSession socket)throws Exception {
        var principal=(AccountPrincipal)socket.getAttributes().get("principal");var session=(HttpSession)socket.getAttributes().get("httpSession");
        var connection=new Connection(new ConcurrentWebSocketSessionDecorator(socket,10000,1024*1024),session,principal);
        if(!valid(connection)){socket.close(CloseStatus.POLICY_VIOLATION);return;}
        connections.put(socket.getId(),connection);LOGGER.info("系统通知连接建立：userId={}",principal.userId());
        send(connection,Map.of("type","UNREAD_UPDATED","count",notices.unread(principal.userId())));
    }
    @Override protected void handleTextMessage(WebSocketSession socket,TextMessage message)throws Exception {
        Connection connection=connections.get(socket.getId());if(connection==null||!valid(connection)){socket.close(CloseStatus.POLICY_VIOLATION);return;}
        // 本阶段只接受心跳，通知已读使用有CSRF保护的HTTP接口，不提供任意发送功能。
        if(message.getPayloadLength()>256){socket.close(CloseStatus.TOO_BIG_TO_PROCESS);return;}
        if("PING".equals(message.getPayload())||"PING".equals(json.readTree(message.getPayload()).path("type").asText()))send(connection,Map.of("type","PONG"));
    }
    @Override protected void handlePongMessage(WebSocketSession socket,PongMessage message)throws Exception {
        Connection connection=connections.get(socket.getId());if(connection==null||!valid(connection))socket.close(CloseStatus.POLICY_VIOLATION);
    }
    @Override public void afterConnectionClosed(WebSocketSession socket,CloseStatus status){connections.remove(socket.getId());}
    @Override public void handleTransportError(WebSocketSession socket,Throwable error)throws Exception {connections.remove(socket.getId());socket.close(CloseStatus.SERVER_ERROR);}
    /** 事务提交后向同一用户全部有效连接推送，单端失败不影响其他端。 */
    public void publish(Long userId,Object event){connections.values().stream().filter(c->c.principal.userId().equals(userId)).forEach(c->send(c,event));}
    @EventListener public void revoked(SessionRevokedEvent event){connections.values().stream().filter(c->{try{return c.session.getId().equals(event.sessionId());}catch(IllegalStateException e){return true;}}).forEach(this::close);}
    @Scheduled(fixedDelay=1000) public void checkCredentials(){connections.values().forEach(c->{if(!valid(c))close(c);});}
    private boolean valid(Connection c){
        try {
            c.session.getCreationTime();if(!clock.instant().isBefore(c.principal.expiresAt()))return false;
            var user=accounts.findById(c.principal.userId());return user!=null&&c.principal.matches(user.getPasswordHash());
        }catch(IllegalStateException e){return false;}catch(RuntimeException e){LOGGER.error("通知连接凭证检查异常：userId={}",c.principal.userId(),SafeLog.exception(e));return false;}
    }
    private void send(Connection c,Object event){
        if(!valid(c)){close(c);return;}
        try{c.socket.sendMessage(new TextMessage(json.writeValueAsString(event)));}
        catch(Exception e){LOGGER.warn("系统通知推送失败：stage=网络发送, userId={}, reason=连接已中断，通知可重新查询",c.principal.userId());close(c);}
    }
    private void close(Connection c){connections.remove(c.socket.getId());try{c.socket.close(CloseStatus.POLICY_VIOLATION);}catch(Exception ignored){}}
}
