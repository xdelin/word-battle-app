package com.wordbattle.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_lesson_progress")
@Getter
@Setter
public class UserLessonProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "lesson_id")
    private Integer lessonId;

    @Column(name = "challenges_completed")
    private Integer challengesCompleted;

    @Column(name = "total_challenges")
    private Integer totalChallenges;

    @Column(name = "is_completed")
    private Boolean isCompleted;

    @Column(name = "hearts_used")
    private Integer heartsUsed;

    @Column(name = "xp_earned")
    private Integer xpEarned;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
