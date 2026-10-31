package com.wordbattle.studyroom;

import java.time.Instant;
import java.util.UUID;

/** 申请列表投影（join users 拿 name/avatarUrl）。 */
public interface StudyRoomApplicationProjection {
    UUID getId();
    UUID getUserId();
    String getUserName();
    String getAvatarUrl();
    Instant getCreatedAt();
}
