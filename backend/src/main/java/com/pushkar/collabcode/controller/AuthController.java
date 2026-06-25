package com.pushkar.collabcode.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.pushkar.collabcode.service.AuthService;

@RestController

@RequestMapping("/auth")

public class AuthController {

    private final AuthService service;

    public AuthController(
        AuthService service
    ) {
        this.service = service;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(
        @RequestBody
        Map<String,String> body
    ) {
        try {
            service.register(
                body.get("username"),
                body.get("displayName"),
                body.get("password")
            );
            return ResponseEntity
                .status(
                    HttpStatus.CREATED
                )
                .body(
                    Map.of(
                        "message",
                        "User registered successfully"
                    )
                );
        }
        catch (RuntimeException e) {
            return ResponseEntity
                .status(
                    HttpStatus.CONFLICT
                )
                .body(
                    Map.of(
                        "error",
                        e.getMessage()
                    )
                );
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
        @RequestBody
        Map<String,String> body
    ) {
        try {
            String token =
                service.login(
                    body.get(
                        "username"
                    ),
                    body.get(
                        "password"
                    )
                );
            return ResponseEntity.ok(
                Map.of(
                    "token",
                    token
                )
            );
        }
        catch (RuntimeException e) {
            return ResponseEntity
                .status(
                    HttpStatus.UNAUTHORIZED
                )
                .body(
                    Map.of(
                        "error",
                        e.getMessage()
                    )
                );
        }
    }
}