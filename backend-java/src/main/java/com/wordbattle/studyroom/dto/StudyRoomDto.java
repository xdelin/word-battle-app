package com.wordbattle.studyroom.dto;

import java.time.Instant;

/** 自习室（列表/详情用）。memberCount 为当前成员数。 */
public record StudyRoomDto(
        String id,
        String name,
        String code,
        String ownerId,
        Boolean isPublic,
        Boolean requireApproval,
        Integer dailyGoal,
        Integer memberCount,
        Instant createdAt
) {
}
