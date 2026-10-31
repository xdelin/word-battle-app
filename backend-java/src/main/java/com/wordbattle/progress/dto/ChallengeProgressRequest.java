package com.wordbattle.progress.dto;

import jakarta.validation.constraints.NotNull;

public record ChallengeProgressRequest(
        @NotNull Integer challengeId,
        @NotNull Boolean isCorrect,
        @NotNull Integer timeSpent
) {
}
