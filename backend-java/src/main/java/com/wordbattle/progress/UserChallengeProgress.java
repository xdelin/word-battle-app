package com.wordbattle.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_challenge_progress")
@Getter
@Setter
public class UserChallengeProgress {

    // 注：DB 实际类型为 serial integer（Drizzle schema 标 uuid，属历史遗留）
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "challenge_id")
    private Integer challengeId;

    @Column(name = "is_completed")
    private Boolean isCompleted;

    @Column(name = "attempts")
    private Integer attempts;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "time_spent")
    private Integer timeSpent;

    @Column(name = "completed_at")
    private Instant completedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
