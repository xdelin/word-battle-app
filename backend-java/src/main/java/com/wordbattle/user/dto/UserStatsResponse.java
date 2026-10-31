package com.wordbattle.user.dto;

/** 个人页统计四格 + 连签（学习天数来自 Redis BitMap，其余来自 user_stats）。 */
public record UserStatsResponse(
        long studyDays,
        int wordsLearned,
        int totalXp,
        int powerWordRank,
        int consecutiveDays
) {
}
