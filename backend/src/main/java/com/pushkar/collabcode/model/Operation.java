package com.pushkar.collabcode.model;

import lombok.Data;
import java.util.List;

@Data
public class Operation {
    private OperationType type;
    private String id;
    private String value;
    private List<PositionComponent> position;
}