package com.pushkar.collabcode.service;

import java.util.List;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.pushkar.collabcode.model.User;
import com.pushkar.collabcode.repository.UserRepository;
import com.pushkar.collabcode.security.JwtUtil;

@Service
public class AuthService {
    private static final List<String> COLORS =
        List.of(
            "#F44336",
            "#2196F3",
            "#4CAF50",
            "#9C27B0",
            "#FF9800",
            "#009688",
            "#E91E63",
            "#3F51B5"
        );
    private final UserRepository repository;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder encoder =
        new BCryptPasswordEncoder();

    public AuthService(
        UserRepository repository,
        JwtUtil jwtUtil
    ) {
        this.repository = repository;
        this.jwtUtil = jwtUtil;
    }
    public void register(
        String username,
        String displayName,
        String password
    ) {
        if (
            repository
            .findByUsername(username)
            .isPresent()
        ) {
            throw new RuntimeException(
                "Username already exists"
            );
        }
        User user = new User();
        user.setUsername(
            username
        );
        user.setDisplayName(
            displayName
        );
        user.setPasswordHash(
            encoder.encode(password)
        );
        user.setColor(
            COLORS.get(
                Math.abs(
                    username.hashCode()
                )
                %
                COLORS.size()
            )
        );
        repository.save(user);
    }
    public String login(
        String username,
        String password
    ) {
        User user = repository
            .findByUsername(
                username
            )
            .orElseThrow(
                () -> new RuntimeException(
                    "Invalid credentials"
                )
            );
        if (
            !encoder.matches(
                password,
                user.getPasswordHash()
            )
        ) {
            throw new RuntimeException(
                "Invalid credentials"
            );
        }
        return jwtUtil.generateToken(
            user
        );
    }
}