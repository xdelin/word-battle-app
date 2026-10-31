package com.wordbattle.pk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SubmitAnswerRequest(
        @NotBlank String userId,
        @NotBlank String roomId,
        @NotBlank String questionId,
        @NotNull Integer selectedOption,
        Integer timeSpent,
        /** 幂等键：前端按 (userId, roomId, questionId) 确定性生成，同一答案重试复用同一个键。可选。 */
        String requestId
) {
}
