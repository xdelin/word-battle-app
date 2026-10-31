package com.wordbattle.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface UserSettingsRepository extends JpaRepository<UserSettings, UUID> {

    /** 今日已完成关卡数（completedAt >= 当日 UTC 0 点）。 */
    @Query(value = """
            select count(*) from user_lesson_progress
            where user_id = cast(:userId as uuid) and is_completed = true and completed_at >= :since
            """, nativeQuery = true)
    long countTodayCompletedLessons(@Param("userId") String userId, @Param("since") Instant since);

    /**
     * 每日目标 upsert。只插入 user_id + daily_goal_lessons，其余列走 DB 默认值（NOT NULL 列不报错）。
     * user_id 是主键，ON CONFLICT 触发更新。clearAutomatically 避免脏的一级缓存。
     */
    @Modifying(clearAutomatically = true)
    @Query(value = """
            insert into user_settings (user_id, daily_goal_lessons)
            values (cast(:userId as uuid), :goal)
            on conflict (user_id) do update
            set daily_goal_lessons = :goal, updated_at = now()
            """, nativeQuery = true)
    void upsertDailyGoalLessons(@Param("userId") String userId, @Param("goal") int goal);
}
