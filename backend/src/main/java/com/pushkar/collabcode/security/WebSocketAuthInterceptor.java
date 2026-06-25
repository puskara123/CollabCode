package com.pushkar.collabcode.security;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import io.jsonwebtoken.Claims;

import jakarta.servlet.http.HttpServletRequest;

@Component
public class WebSocketAuthInterceptor
    implements HandshakeInterceptor {
    private final JwtUtil jwtUtil;
    public WebSocketAuthInterceptor(
        JwtUtil jwtUtil
    ) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(
        ServerHttpRequest request,
        ServerHttpResponse response,
        WebSocketHandler wsHandler,
        Map<String, Object> attributes
    ) {
        /*if (
            !(request instanceof ServletServerHttpRequest)
        ) {
            return false;
        }
        HttpServletRequest servletRequest =
            ((ServletServerHttpRequest) request)
            .getServletRequest();
        String header =
            servletRequest.getHeader(
                "Authorization"
            );
        if (
            header == null
            ||
            !header.startsWith(
                "Bearer "
            )
        ) {
            return false;
        }
        String token =
            header.substring(7);
        if (
            !jwtUtil.validateToken(
                token
            )
        ) {
            return false;
        }
        Claims claims =
            jwtUtil.extractClaims(
                token
            );
        String userId =
            claims.getSubject();
        attributes.put(
            "principal",
            (Principal) () -> userId
        )*/
        return true;
    }

    @Override
    public void afterHandshake(
        ServerHttpRequest request,
        ServerHttpResponse response,
        WebSocketHandler wsHandler,
        Exception exception
    ) {
    }
}