package com.pushkar.collabcode.websocket;

import com.pushkar.collabcode.model.Operation;
import com.pushkar.collabcode.repository.OperationRepository;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;

@Controller
public class MessageController {

    private final OperationRepository repository;

    private final SimpMessagingTemplate messagingTemplate;

    public MessageController(

        OperationRepository repository,

        SimpMessagingTemplate messagingTemplate

    ) {

        this.repository = repository;

        this.messagingTemplate = messagingTemplate;

    }

    @MessageMapping("/send")

    public void send(

        Operation operation, Principal principal

    ) {     

        repository.save(operation);

        messagingTemplate.convertAndSend(

            "/topic/document/" +

            operation.getDocumentId(),

            operation

        );

    }

}