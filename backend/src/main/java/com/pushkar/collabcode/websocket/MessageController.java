package com.pushkar.collabcode.websocket;

import com.pushkar.collabcode.model.Operation;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class MessageController {

    @MessageMapping("/send")
    @SendTo("/topic/messages")
    public Operation send(Operation operation) {
        return operation;
    }
}