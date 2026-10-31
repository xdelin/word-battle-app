package com.wordbattle.pk.dto;

/** 排行榜条目（名次从 1 开始）。 */
public record LeaderboardEntryDto(String userId, String name, int score, int rank) {
}
