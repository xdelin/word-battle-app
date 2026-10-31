package com.wordbattle.studyroom;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** 自习室成员。 */
@Entity
@Table(name = "study_room_members")
@Getter
@Setter
public class StudyRoomMember {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "room_id")
    private UUID roomId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "is_admin")
    private Boolean isAdmin;

    @Column(name = "joined_at")
    private Instant joinedAt;
}
