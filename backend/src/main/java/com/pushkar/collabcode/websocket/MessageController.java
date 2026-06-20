package com.pushkar.collabcode.websocket;

import com.pushkar.collabcode.model.Operation;
import com.pushkar.collabcode.repository.OperationRepository;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class MessageController {

    private final OperationRepository repository;

    public MessageController(
        OperationRepository repository
    ) {
        this.repository = repository;
    }

    @MessageMapping("/send")
    @SendTo("/topic/messages")
    public Operation send(
        Operation operation
    ) {

        repository.save(operation);

        return operation;
    }
}