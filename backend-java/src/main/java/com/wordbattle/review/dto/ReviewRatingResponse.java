package com.wordbattle.review.dto;

/** 评分响应。nextReview 为 ISO-8601 字符串。 */
public record ReviewRatingResponse(
        boolean success,
        String nextReview,
        int interval,
        double stability,
        double difficulty
) {
}
