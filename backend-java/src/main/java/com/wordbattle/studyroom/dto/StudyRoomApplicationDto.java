package com.wordbattle.studyroom.dto;

import java.time.Instant;

/** 加入申请（含用户信息）。 */
public record StudyRoomApplicationDto(
        String id,
        String userId,
        String userName,
        String avatarUrl,
        String status,
        Instant createdAt
) {
}
