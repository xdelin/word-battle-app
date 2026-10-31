package com.wordbattle.user;

import com.wordbattle.user.dto.UserSettingsResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserSettingsRepository settingsRepository;
    private final CurrentUserResolver currentUser;

    public UserService(UserSettingsRepository settingsRepository, CurrentUserResolver currentUser) {
        this.settingsRepository = settingsRepository;
        this.currentUser = currentUser;
    }

    private UUID userId() {
        return UUID.fromString(currentUser.getUserId());
    }

    public UserSettingsResponse getSettings() {
        return settingsRepository.findById(userId())
                .map(UserSettingsResponse::from)
                .orElseGet(() -> UserSettingsResponse.defaultFor(currentUser.getUserId()));
    }

    /** 今日已完成关卡数（UTC 当天 0 点起，与前端 startOfTodayUTC 一致）。 */
    public long countTodayCompletedLessons() {
        Instant since = Instant.now().truncatedTo(ChronoUnit.DAYS);
        return settingsRepository.countTodayCompletedLessons(currentUser.getUserId(), since);
    }

    /**
     * 更新每日目标关卡数（1~50），不存在则插入。
     * 用原生 upsert，避免 JPA 对 NOT NULL 默认列插 NULL 报错。
     */
    @Transactional
    public UserSettingsResponse updateDailyGoalLessons(int goal) {
        int clamped = Math.max(1, Math.min(50, goal));
        settingsRepository.upsertDailyGoalLessons(currentUser.getUserId(), clamped);
        return getSettings();
    }
}
