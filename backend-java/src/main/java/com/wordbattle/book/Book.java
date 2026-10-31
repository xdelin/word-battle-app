package com.wordbattle.book;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 词书。对应 books 表（schema 由 Drizzle/SQL 管理，JPA 只读写）。
 */
@Entity
@Table(name = "books")
@Getter
@Setter
public class Book {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "short_name", nullable = false, unique = true)
    private String shortName;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "level", nullable = false)
    private String level;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "image_url", nullable = false)
    private String imageUrl;

    @Column(name = "total_words")
    private Integer totalWords;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
