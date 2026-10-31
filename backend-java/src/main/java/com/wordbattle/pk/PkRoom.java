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
@Table(name = "pk_rooms")
@Getter
@Setter
public class PkRoom {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "room_code")
    private String roomCode;

    @Column(name = "type")
    private String type;

    @Column(name = "status")
    private String status;

    @Column(name = "book_id")
    private Integer bookId;

    @Column(name = "question_count")
    private Integer questionCount;

    @Column(name = "time_per_question")
    private Integer timePerQuestion;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "next_room_id")
    private UUID nextRoomId;
}
