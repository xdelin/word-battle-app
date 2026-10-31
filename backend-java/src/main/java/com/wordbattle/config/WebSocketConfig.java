package com.wordbattle.config;

import com.wordbattle.pk.PkSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PkSocketHandler pkSocketHandler;

    public WebSocketConfig(PkSocketHandler pkSocketHandler) {
        this.pkSocketHandler = pkSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(pkSocketHandler, "/ws/pk").setAllowedOriginPatterns("*");
    }
}
