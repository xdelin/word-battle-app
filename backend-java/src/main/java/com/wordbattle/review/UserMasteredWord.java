package com.wordbattle.review;

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
@Table(name = "user_mastered_words")
@Getter
@Setter
public class UserMasteredWord {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "word")
    private String word;

    @CreationTimestamp
    @Column(name = "mastered_at", updatable = false)
    private Instant masteredAt;
}
