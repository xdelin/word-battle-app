package com.wordbattle.studyroom;

import java.time.Instant;
import java.util.UUID;

/** 成员列表投影（join users 拿 name/avatarUrl，join user_study_daily/user_stats 拿统计）。 */
public interface StudyRoomMemberProjection {
    UUID getUserId();
    String getName();
    String getAvatarUrl();
    Boolean getIsAdmin();
    Instant getJoinedAt();
    Integer getTodayNewWords();
    Integer getTodayReviewWords();
    Integer getStreakDays();
    Integer getTotalStudyDays();
}
