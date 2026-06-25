package com.pushkar.collabcode.security;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.pushkar.collabcode.model.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiry}")
    private long expiry;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(
            secret.getBytes(
                StandardCharsets.UTF_8
            )
        );
    }

    public String generateToken(
        User user
    ) {
        Date now = new Date();
        Date expiration =
            new Date(
                now.getTime() + expiry
            );

        return Jwts.builder()
            .subject(
                user.getId()
            )
            .claim(
                "username",
                user.getUsername()
            )
            .claim(
                "displayName",
                user.getDisplayName()
            )
            .claim(
                "color",
                user.getColor()
            )
            .issuedAt(now)
            .expiration(expiration)
            .signWith(
                getSigningKey()
            )
            .compact();
    }

    public Claims extractClaims(
        String token
    ) {
        return Jwts.parser()
            .verifyWith(
                getSigningKey()
            )
            .build()
            .parseSignedClaims(
                token
            )
            .getPayload();
    }
    public boolean validateToken(
        String token
    ) {
        try {
            extractClaims(token);
            return true;
        }
        catch (Exception e) {
            return false;
        }
    }
}