package com.wordbattle.studyroom.dto;

import java.time.Instant;

/** 打卡提醒。 */
public record ReminderDto(
        String id,
        String fromUserId,
        String fromUserName,
        String fromUserAvatar,
        String message,
        Instant createdAt
) {
}
