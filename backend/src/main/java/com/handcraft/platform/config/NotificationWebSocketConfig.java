package com.handcraft.platform.config;

import com.handcraft.platform.modules.security.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.*;
import org.springframework.http.server.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.server.HandshakeInterceptor;

/** 原生WebSocket共享HTTP会话；Origin使用与HTTP相同的精确白名单。 */
@Configuration @EnableWebSocket
public class NotificationWebSocketConfig implements WebSocketConfigurer {
    private final NotificationSocketHandler handler;
    private final List<String> origins;
    public NotificationWebSocketConfig(NotificationSocketHandler handler,@Value("${app.cors.allowed-origins}")List<String> origins){this.handler=handler;this.origins=origins;}
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){
        registry.addHandler(handler,"/api/ws").setAllowedOrigins(origins.toArray(String[]::new)).addInterceptors(new HandshakeInterceptor(){
            public boolean beforeHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler ws,Map<String,Object> attributes){
                if(request instanceof ServletServerHttpRequest servlet&&request.getPrincipal() instanceof Authentication auth&&auth.getPrincipal() instanceof AccountPrincipal principal){
                    var session=servlet.getServletRequest().getSession(false);
                    if(session!=null){attributes.put("principal",principal);attributes.put("httpSession",session);return true;}
                }
                response.setStatusCode(HttpStatus.UNAUTHORIZED);return false;
            }
            public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler ws,Exception error){}
        });
    }
}
