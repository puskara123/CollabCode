package com.pushkar.collabcode.websocket;

import com.pushkar.collabcode.model.Operation;
import com.pushkar.collabcode.repository.OperationRepository;
import com.pushkar.collabcode.service.SessionRegistry;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import com.pushkar.collabcode.model.OperationType;

import java.security.Principal;

@Controller
public class MessageController {

    private final OperationRepository repository;

    private final SimpMessagingTemplate messagingTemplate;

    private final SessionRegistry sessionRegistry;

    public MessageController(

        OperationRepository repository,

        SimpMessagingTemplate messagingTemplate, 
        
        SessionRegistry sessionRegistry

    ) {

        this.repository = repository;

        this.messagingTemplate = messagingTemplate;

        this.sessionRegistry = sessionRegistry;

    }

    @MessageMapping("/send") 
    public void send(
        Operation operation, Principal principal, SimpMessageHeaderAccessor headerAccessor
    ) {     
        String sessionId =
            headerAccessor.getSessionId();

        sessionRegistry.register(
            sessionId,
            operation.getDocumentId(),
            operation.getClientId()
        );

        repository.save(operation);
        messagingTemplate.convertAndSend(
            "/topic/document/" +
            operation.getDocumentId(),
            operation
        );
    }

    @MessageMapping("/cursor")
    public void cursor(
        Operation operation,
        Principal principal,
        SimpMessageHeaderAccessor headerAccessor
    ){
        String sessionId =
            headerAccessor.getSessionId();

        sessionRegistry.register(
            sessionId,
            operation.getDocumentId(),
            operation.getClientId()
        );
        messagingTemplate.convertAndSend(
            "/topic/document/" + operation.getDocumentId(),
            operation
        );
    }

    @EventListener
    public void handleDisconnect(
        SessionDisconnectEvent event
    ){
        String sessionId =
            event.getSessionId();

        SessionRegistry.SessionInfo info =
            sessionRegistry.get(sessionId);

        if (info == null) {     
            return;
        }

        Operation leave = new Operation();

        leave.setType(OperationType.LEAVE);

        leave.setDocumentId(        
            info.documentId()
        );

        leave.setClientId(
            info.clientId()
        );

        messagingTemplate.convertAndSend(
            "/topic/document/" +
            info.documentId(),
            leave
        );

        sessionRegistry.remove(sessionId); 
        System.out.println(sessionRegistry.get(sessionId)); 
        System.out.println("LEAVE broadcast for " + info.clientId());
    }
}