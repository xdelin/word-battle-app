package com.wordbattle.studyroom;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** 自习室。 */
@Entity
@Table(name = "study_rooms")
@Getter
@Setter
public class StudyRoom {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "name")
    private String name;

    @Column(name = "code")
    private String code;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "is_public")
    private Boolean isPublic;

    @Column(name = "require_approval")
    private Boolean requireApproval;

    @Column(name = "daily_goal")
    private Integer dailyGoal;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
