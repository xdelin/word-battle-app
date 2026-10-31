package com.wordbattle.pk.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateRoomRequest(
        @NotBlank String userId,
        String userName,
        String type,        // friend | random | npc
        Integer bookId,
        Integer questionCount,
        Integer timePerQuestion
) {
}
