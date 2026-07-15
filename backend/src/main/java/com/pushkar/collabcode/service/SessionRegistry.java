package com.pushkar.collabcode.service;

import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionRegistry {

    public record SessionInfo(
            String documentId,
            String clientId
    ) {}

    private final ConcurrentHashMap<String, SessionInfo> sessions =
            new ConcurrentHashMap<>();

    public void register(
            String sessionId,
            String documentId,
            String clientId
    ) {
        sessions.put(
                sessionId,
                new SessionInfo(documentId, clientId)
        );
    }

    public SessionInfo get(
            String sessionId
    ) {
        return sessions.get(sessionId);
    }

    public void remove(
            String sessionId
    ) {
        sessions.remove(sessionId);
    }

}