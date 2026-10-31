package com.wordbattle.studyroom.dto;

import java.time.Instant;

/** 自习室成员（含用户基本信息 + 学习统计）。 */
public record StudyRoomMemberDto(
        String userId,
        String name,
        String avatarUrl,
        Boolean isAdmin,
        Instant joinedAt,
        Integer todayNewWords,
        Integer todayReviewWords,
        Integer streakDays,
        Integer totalStudyDays
) {
}
