package com.wordbattle.progress;

import com.wordbattle.progress.dto.ChallengeProgressRequest;
import com.wordbattle.progress.dto.LessonProgressRequest;
import com.wordbattle.user.CurrentUserResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * 闯关进度写入。1:1 复刻前端 learning-progress.ts：
 *   updateChallengeProgress：每题记录 attempts/isCorrect/timeSpent，答错扣 1 心
 *   updateLessonProgress：关卡完成时 upsert，累加 hearts/xp，完成则给经验+掌握词
 *
 * 与前端一致的取舍：用 find+save（非原子 upsert）。单测试用户无并发冲突；
 * 多用户高并发时各用户 (userId, challengeId) 互不冲突，原子性可在后续加唯一索引优化。
 */
@Service
@Transactional
public class ProgressService {

    private final UserChallengeProgressRepository challengeProgressRepository;
    private final UserLessonProgressRepository lessonProgressRepository;
    private final UserStatsRepository statsRepository;
    private final CurrentUserResolver currentUser;
    private final StudyStatsService studyStatsService;

    public ProgressService(UserChallengeProgressRepository challengeProgressRepository,
                           UserLessonProgressRepository lessonProgressRepository,
                           UserStatsRepository statsRepository,
                           CurrentUserResolver currentUser,
                           StudyStatsService studyStatsService) {
        this.challengeProgressRepository = challengeProgressRepository;
        this.lessonProgressRepository = lessonProgressRepository;
        this.statsRepository = statsRepository;
        this.currentUser = currentUser;
        this.studyStatsService = studyStatsService;
    }

    private UUID userId() {
        return UUID.fromString(currentUser.getUserId());
    }

    public void updateChallengeProgress(ChallengeProgressRequest req) {
        UUID userId = userId();
        boolean isCorrect = Boolean.TRUE.equals(req.isCorrect());
        Instant now = Instant.now();

        Optional<UserChallengeProgress> existing = challengeProgressRepository
                .findByUserIdAndChallengeId(userId, req.challengeId());

        if (existing.isPresent()) {
            UserChallengeProgress p = existing.get();
            p.setIsCorrect(isCorrect);
            p.setIsCompleted(isCorrect);
            p.setAttempts((p.getAttempts() == null ? 0 : p.getAttempts()) + 1);
            p.setTimeSpent(req.timeSpent());
            if (isCorrect) {
                p.setCompletedAt(now);
            }
            challengeProgressRepository.save(p);
        } else {
            UserChallengeProgress p = new UserChallengeProgress();
            p.setUserId(userId);
            p.setChallengeId(req.challengeId());
            p.setIsCompleted(isCorrect);
            p.setAttempts(1);
            p.setIsCorrect(isCorrect);
            p.setTimeSpent(req.timeSpent());
            p.setCompletedAt(isCorrect ? now : null);
            challengeProgressRepository.save(p);
        }

        if (!isCorrect) {
            challengeProgressRepository.reduceHearts(currentUser.getUserId());
        }
    }

    public void updateLessonProgress(LessonProgressRequest req) {
        UUID userId = userId();
        boolean isCompleted = Boolean.TRUE.equals(req.isCompleted());
        Instant now = Instant.now();

        Optional<UserLessonProgress> existing = lessonProgressRepository
                .findByUserIdAndLessonId(userId, req.lessonId());

        if (existing.isPresent()) {
            UserLessonProgress p = existing.get();
            p.setIsCompleted(Boolean.TRUE.equals(p.getIsCompleted()) || isCompleted);
            p.setHeartsUsed((p.getHeartsUsed() == null ? 0 : p.getHeartsUsed()) + req.heartsUsed());
            p.setXpEarned((p.getXpEarned() == null ? 0 : p.getXpEarned()) + req.xpEarned());
            if (isCompleted) {
                p.setCompletedAt(now);
            }
            lessonProgressRepository.save(p);
        } else {
            UserLessonProgress p = new UserLessonProgress();
            p.setUserId(userId);
            p.setLessonId(req.lessonId());
            p.setIsCompleted(isCompleted);
            p.setHeartsUsed(req.heartsUsed());
            p.setXpEarned(req.xpEarned());
            p.setCompletedAt(isCompleted ? now : null);
            p.setChallengesCompleted(0);
            p.setTotalChallenges(0);
            p.setStartedAt(now);
            lessonProgressRepository.save(p);
        }

        if (isCompleted && req.xpEarned() != null && req.xpEarned() > 0) {
            statsRepository.addXpAndWord(currentUser.getUserId(), req.xpEarned());
            // 完成课程 = 新学单词，记入每日统计 + 连续/总天数
            studyStatsService.recordStudy(userId, 1, 0);
        }
    }
}
