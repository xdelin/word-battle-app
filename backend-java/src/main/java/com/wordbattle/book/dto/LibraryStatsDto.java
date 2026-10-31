package com.wordbattle.book.dto;

/**
 * 首页底部统计：总词数、总关卡数、词库数（均排除隐藏词库）。
 */
public record LibraryStatsDto(
        long totalWords,
        long totalLessons,
        int bookCount
) {
}
