package com.pushkar.collabcode.model;

import lombok.Data;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "operation")
public class Operation {
    @Id
    private String id;
    private String documentId;
    private String clientId;
    private OperationType type;
    private String value;
    private List<PositionComponent> position;

    private Integer line;
    private Integer column;
}