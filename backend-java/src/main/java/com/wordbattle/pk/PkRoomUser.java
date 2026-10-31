package com.wordbattle.pk;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pk_room_users")
@Getter
@Setter
public class PkRoomUser {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "room_id")
    private UUID roomId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "seat_no")
    private Integer seatNo;

    @Column(name = "is_host")
    private Boolean isHost;

    @Column(name = "is_ready")
    private Boolean isReady;

    @Column(name = "total_score")
    private Integer totalScore;

    @Column(name = "correct_count")
    private Integer correctCount;

    @Column(name = "question_index")
    private Integer questionIndex;

    @Column(name = "connected_at")
    private Instant connectedAt;

    @Column(name = "disconnected_at")
    private Instant disconnectedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
