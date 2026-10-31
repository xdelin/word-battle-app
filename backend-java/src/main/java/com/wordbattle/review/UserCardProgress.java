package com.wordbattle.review;

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
 * 用户卡片复习进度（FSRS 状态）。对应 user_card_progress。
 * id 为 uuid（DB 与 schema 一致）。
 *
 * 字段命名与 DB 列对齐：fsrsState/fsrsStability(fsrs_stability)/fsrsDueDate(fsrs_due_date) 等。
 * stability/difficulty 在 DB 存为 text（原 TS 端 toString 落库），此处用 String 映射，
 * 业务层用 Double 解析，避免迁移期旧数据解析失败。
 */
@Entity
@Table(name = "user_card_progress")
@Getter
@Setter
public class UserCardProgress {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "card_id")
    private UUID cardId;

    @Column(name = "fsrs_state")
    private String fsrsState;

    @Column(name = "fsrs_stability")
    private String fsrsStability;

    @Column(name = "fsrs_difficulty")
    private String fsrsDifficulty;

    @Column(name = "fsrs_last_reviewed_at")
    private Instant fsrsLastReviewedAt;

    @Column(name = "fsrs_scheduled_days")
    private Integer fsrsScheduledDays;

    @Column(name = "fsrs_due_date")
    private Instant fsrsDueDate;

    @Column(name = "fsrs_step_index")
    private Integer fsrsStepIndex;

    @Column(name = "total_reviews")
    private Integer totalReviews;

    @Column(name = "total_lapses")
    private Integer totalLapses;

    @Column(name = "total_correct")
    private Integer totalCorrect;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
