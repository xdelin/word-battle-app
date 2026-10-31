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
@Table(name = "courses")
@Getter
@Setter
public class Course {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "book_id")
    private Integer bookId;

    @Column(name = "title")
    private String title;

    @Column(name = "description")
    private String description;

    // order 是 SQL 保留字，需引号引用列名
    @Column(name = "\"order\"")
    private Integer order;

    @Column(name = "image_url")
    private String imageUrl;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
