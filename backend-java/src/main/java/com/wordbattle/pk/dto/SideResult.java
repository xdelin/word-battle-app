package com.wordbattle.pk.dto;

/** 单方作答结果（NPC 模式同时返回双方）。 */
public record SideResult(
        boolean isCorrect,
        int score,
        int timeSpent
) {
}
