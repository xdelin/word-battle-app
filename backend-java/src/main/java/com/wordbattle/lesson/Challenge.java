package com.wordbattle.lesson;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "challenges")
@Getter
@Setter
public class Challenge {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "lesson_id")
    private Integer lessonId;

    @Column(name = "type")
    private String type;

    @Column(name = "question")
    private String question;

    @Column(name = "audio_url")
    private String audioUrl;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "\"order\"")
    private Integer order;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
