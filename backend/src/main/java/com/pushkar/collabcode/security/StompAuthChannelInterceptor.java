package com.pushkar.collabcode.security;

import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;

import io.jsonwebtoken.Claims;

import org.springframework.stereotype.Component;

import java.util.Collections;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import org.springframework.messaging.support.MessageHeaderAccessor;

@Component
public class StompAuthChannelInterceptor
    implements ChannelInterceptor {
    private final JwtUtil jwtUtil;
    public StompAuthChannelInterceptor(
        JwtUtil jwtUtil
    ) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public Message<?> preSend(
        @NonNull Message<?> message,
        @NonNull MessageChannel channel
    ) {

        StompHeaderAccessor accessor =
            MessageHeaderAccessor.getAccessor(
                message,
                StompHeaderAccessor.class
            );

        if (accessor == null) {
            return message;
        }

        if (
            StompCommand.CONNECT.equals(
                accessor.getCommand()
            )
        ) {

            String authHeader =
                accessor.getFirstNativeHeader(
                    "Authorization"
                );

            if (
                authHeader == null ||
                !authHeader.startsWith(
                    "Bearer "
                )
            ) {
                throw new IllegalArgumentException(
                    "Missing Authorization header"
                );
            }
            String token =
                authHeader.substring(7);
            if (
                !jwtUtil.validateToken(
                    token
                )
            ) {
                throw new IllegalArgumentException(
                    "Invalid JWT"
                );
            }
            Claims claims =
                jwtUtil.extractClaims(
                    token
                );
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    claims.getSubject(),
                    null,
                    Collections.emptyList()
                );

            accessor.setUser(
                authentication
            );
        }
        return message;
    }
}