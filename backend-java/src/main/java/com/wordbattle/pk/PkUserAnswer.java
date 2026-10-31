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
@Table(name = "pk_user_answers")
@Getter
@Setter
public class PkUserAnswer {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "room_id")
    private UUID roomId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "question_id")
    private UUID questionId;

    @Column(name = "selected_option")
    private Integer selectedOption;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "time_spent")
    private Integer timeSpent;

    @Column(name = "score")
    private Integer score;

    @Column(name = "answered_at")
    private Instant answeredAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
