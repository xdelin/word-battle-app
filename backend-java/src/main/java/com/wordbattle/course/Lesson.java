package com.wordbattle.course;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "lessons")
@Getter
@Setter
public class Lesson {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "unit_id")
    private Integer unitId;

    @Column(name = "title")
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "\"order\"")
    private Integer order;

    @Column(name = "is_boss_lesson")
    private Boolean isBossLesson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
