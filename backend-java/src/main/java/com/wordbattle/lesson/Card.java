package com.wordbattle.lesson;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 词书词条（cards 表）。仅取 word/tags/difficulty；富字段统一从 dictionary 取。
 * tags 为 text[]，用 SqlTypes.ARRAY 映射。
 */
@Entity
@Table(name = "cards")
@Getter
@Setter
public class Card {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "word")
    private String word;

    @Column(name = "book_id")
    private Integer bookId;

    @Column(name = "difficulty")
    private Integer difficulty;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "tags", columnDefinition = "text[]")
    private List<String> tags;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
