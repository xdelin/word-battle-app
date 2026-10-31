package com.wordbattle.progress;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * 记录学习活动：upsert 当日统计（user_study_daily）+ 更新连续天数/总学习天数/lastStudyDate。
 * 学习页完成课程记 newWords；复习页评分记 reviewWords。
 */
@Service
public class StudyStatsService {

    private final UserStatsRepository statsRepository;
    private final UserStudyDailyRepository dailyRepository;

    public StudyStatsService(UserStatsRepository statsRepository, UserStudyDailyRepository dailyRepository) {
        this.statsRepository = statsRepository;
        this.dailyRepository = dailyRepository;
    }

    @Transactional
    public void recordStudy(UUID userId, int newDelta, int reviewDelta) {
        if (newDelta == 0 && reviewDelta == 0) return;
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        dailyRepository.upsertDaily(userId.toString(), today, newDelta, reviewDelta);
        statsRepository.findById(userId).ifPresent(stats -> {
            Instant last = stats.getLastStudyDate();
            LocalDate lastDate = last != null ? last.atZone(ZoneOffset.UTC).toLocalDate() : null;
            if (!today.equals(lastDate)) {
                int streak = stats.getStreakDays() == null ? 0 : stats.getStreakDays();
                if (lastDate != null && lastDate.plusDays(1).equals(today)) {
                    streak += 1; // 连续
                } else {
                    streak = 1; // 中断，重新起算
                }
                stats.setStreakDays(streak);
                stats.setTotalStudyDays((stats.getTotalStudyDays() == null ? 0 : stats.getTotalStudyDays()) + 1);
                stats.setLastStudyDate(Instant.now());
                statsRepository.save(stats);
            }
        });
    }
}
