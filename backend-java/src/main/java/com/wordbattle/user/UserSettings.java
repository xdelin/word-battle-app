package com.wordbattle.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * 用户设置。对应 user_settings 表（userId 为主键，引用 users.id）。
 * user_id 为 uuid 列，映射为 java.util.UUID（Hibernate 自动处理）。
 */
@Entity
@Table(name = "user_settings")
@Getter
@Setter
public class UserSettings {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "daily_goal_minutes")
    private Integer dailyGoalMinutes;

    @Column(name = "daily_goal_lessons")
    private Integer dailyGoalLessons;

    @Column(name = "notifications_enabled")
    private Boolean notificationsEnabled;

    @Column(name = "sound_enabled")
    private Boolean soundEnabled;

    @Column(name = "vibrate_enabled")
    private Boolean vibrateEnabled;

    @Column(name = "preferred_difficulty")
    private String preferredDifficulty;

    @Column(name = "language_preference")
    private String languagePreference;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
