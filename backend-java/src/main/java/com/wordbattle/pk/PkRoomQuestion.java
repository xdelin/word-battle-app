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

/**
 * PK 题目。options 为 jsonb 列，实体映射为 String。
 * 写入用原生 SQL（options::jsonb）以匹配 jsonb 列类型；读取时 DB 返回 jsonb 文本（双层编码字符串），
 * 交给 JsonbHelper 二次解析。与 Drizzle 落库格式完全一致。
 */
@Entity
@Table(name = "pk_room_questions")
@Getter
@Setter
public class PkRoomQuestion {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "room_id", insertable = false, updatable = false)
    private UUID roomId;

    @Column(name = "question_index", insertable = false, updatable = false)
    private Integer questionIndex;

    @Column(name = "card_id", insertable = false, updatable = false)
    private UUID cardId;

    @Column(name = "question", insertable = false, updatable = false)
    private String question;

    /** jsonb 字符串（双层编码）：["选项1","选项2",...]。只读（insertable=false），写入走原生 SQL。 */
    @Column(name = "options", insertable = false, updatable = false)
    private String options;

    @Column(name = "correct_index", insertable = false, updatable = false)
    private Integer correctIndex;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
