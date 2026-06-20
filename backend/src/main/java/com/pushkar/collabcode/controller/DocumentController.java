package com.pushkar.collabcode.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

import com.pushkar.collabcode.model.Operation;
import com.pushkar.collabcode.repository.OperationRepository;

@RestController
@CrossOrigin(
    origins = "http://localhost:3000"
)
public class DocumentController {

    private final OperationRepository repository;

    public DocumentController(
        OperationRepository repository
    ) {
        this.repository = repository;
    }

    @GetMapping("/document/{documentId}/bootstrap")
    public List<Operation> bootstrapDocument(

        @PathVariable
        String documentId

    ) {

        return repository.findAll();

    }
}