package com.pushkar.collabcode.model;

import lombok.Data;

@Data
public class Operation {
    private OperationType type;
    private String id;
    private String value;
    private String prevId;
}