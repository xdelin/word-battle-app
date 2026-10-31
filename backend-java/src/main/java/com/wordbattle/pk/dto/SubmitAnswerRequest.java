package com.wordbattle.pk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SubmitAnswerRequest(
        @NotBlank String userId,
        @NotBlank String roomId,
        @NotBlank String questionId,
        @NotNull Integer selectedOption,
        Integer timeSpent
) {
}
