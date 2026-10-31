package com.wordbattle.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** POST /api/review 评分请求。rating: 0忘记/1困难/2良好/3简单。 */
public record ReviewRatingRequest(
        @NotNull String cardId,
        @NotNull @Min(0) @Max(3) Integer rating,
        Integer timeTaken
) {
}
