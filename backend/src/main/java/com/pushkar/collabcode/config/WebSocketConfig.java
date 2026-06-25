package com.pushkar.collabcode.config;

import org.springframework.context.annotation.Configuration;

import org.springframework.messaging.simp.config.MessageBrokerRegistry;

import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;

import org.springframework.web.socket.config.annotation.StompEndpointRegistry;

import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.pushkar.collabcode.security.WebSocketAuthInterceptor;

import org.springframework.messaging.simp.config.ChannelRegistration;

import com.pushkar.collabcode.security.StompAuthChannelInterceptor;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor webSocketAuthInterceptor;
    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    public WebSocketConfig(
        WebSocketAuthInterceptor webSocketAuthInterceptor,
        StompAuthChannelInterceptor stompAuthChannelInterceptor
    ) {
        this.webSocketAuthInterceptor = webSocketAuthInterceptor;
        this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
    }

    @Override
    public void registerStompEndpoints(
        StompEndpointRegistry registry
    ) {
        registry
            .addEndpoint("/ws")
            .addInterceptors(
                webSocketAuthInterceptor
            )
            .setAllowedOrigins("http://localhost:3000")
            .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(
        ChannelRegistration registration
    ) {

        registration.interceptors(
            stompAuthChannelInterceptor
        );

    }

    @Override
    public void configureMessageBroker(
        MessageBrokerRegistry registry
    ) {
        registry.enableSimpleBroker(
            "/topic"
        );
        registry.setApplicationDestinationPrefixes(
            "/app"
        );
    }
}