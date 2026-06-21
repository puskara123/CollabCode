package com.pushkar.collabcode.repository;

import com.pushkar.collabcode.model.Operation;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface OperationRepository extends MongoRepository<Operation, String> {

    List<Operation> findByDocumentId(String documentId);

}