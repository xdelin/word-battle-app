package com.wordbattle.review.dto;

import java.util.List;

/** GET /api/review 响应。 */
public record ReviewQueueResponse(
        List<ReviewItemDto> cards,
        String userId,
        int totalCards,
        int dueCards,
        int newCards
) {
}
