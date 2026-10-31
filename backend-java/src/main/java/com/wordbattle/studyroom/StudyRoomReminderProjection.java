package com.wordbattle.studyroom;

import java.time.Instant;
import java.util.UUID;

/** 提醒列表投影（join users 拿发起人 name/avatarUrl）。 */
public interface StudyRoomReminderProjection {
    UUID getId();
    UUID getFromUserId();
    String getFromUserName();
    String getFromUserAvatar();
    String getMessage();
    Instant getCreatedAt();
}
