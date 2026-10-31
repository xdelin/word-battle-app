package com.wordbattle.pk.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinRoomRequest(
        @NotBlank String userId,
        String userName,
        @NotBlank String roomCode
) {
}
