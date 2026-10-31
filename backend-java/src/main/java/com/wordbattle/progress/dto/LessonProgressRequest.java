package com.wordbattle.progress.dto;

import jakarta.validation.constraints.NotNull;

public record LessonProgressRequest(
        @NotNull Integer lessonId,
        @NotNull Boolean isCompleted,
        @NotNull Integer heartsUsed,
        @NotNull Integer xpEarned
) {
}
