package com.wordbattle.user;

import com.wordbattle.checkin.CheckinService;
import com.wordbattle.progress.UserStats;
import com.wordbattle.progress.UserStatsRepository;
import com.wordbattle.user.dto.UserSettingsResponse;
import com.wordbattle.user.dto.UserStatsResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserSettingsRepository settingsRepository;
    private final UserStatsRepository statsRepository;
    private final CheckinService checkinService;
    private final CurrentUserResolver currentUser;

    public UserService(UserSettingsRepository settingsRepository,
                       UserStatsRepository statsRepository,
                       CheckinService checkinService,
                       CurrentUserResolver currentUser) {
        this.settingsRepository = settingsRepository;
        this.statsRepository = statsRepository;
        this.checkinService = checkinService;
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

    /** 个人页统计四格：学习天数（BitMap）/ 掌握单词 / 总积分 / 词力值 + 连签天数。 */
    public UserStatsResponse getStats() {
        UserStats s = statsRepository.findById(userId()).orElse(null);
        return new UserStatsResponse(
                checkinService.totalStudyDays(),
                s == null || s.getWordsLearned() == null ? 0 : s.getWordsLearned(),
                s == null || s.getTotalXP() == null ? 0 : s.getTotalXP(),
                s == null || s.getPowerWordRank() == null ? 0 : s.getPowerWordRank(),
                checkinService.consecutiveDays()
        );
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
