package com.wordbattle.review.dto;

/** 复习队列单条：card + 进度（全新卡 progress 为 null）。 */
public record ReviewItemDto(
        ReviewCardDto card,
        ProgressDto progress
) {
    public record ProgressDto(
            String fsrsDueDate,
            Integer totalReviews,
            Integer totalCorrect
    ) {
    }
}
