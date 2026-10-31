package com.wordbattle.pk.dto;

public record StartNpcRequest(
        String userId,
        String userName,
        Integer bookId,
        Integer questionCount,
        Integer timePerQuestion
) {
}
