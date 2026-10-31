package com.wordbattle.review.dto;

import jakarta.validation.constraints.NotBlank;

/** 加入复习计划请求。mode: wrong(答错自动) / manual(手动)。 */
public record AddToReviewRequest(
        @NotBlank String word,
        String mode  // "wrong" | "manual"，缺省按 manual
) {
}
