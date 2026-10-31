package com.wordbattle.pk.dto;

public record StartGameRequest(
        String userId,
        String roomId
) {
}
