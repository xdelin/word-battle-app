package com.wordbattle.review.dto;

import jakarta.validation.constraints.NotBlank;

/** 标记单词为已熟记请求。 */
public record MasterWordRequest(
        @NotBlank String word
) {
}
