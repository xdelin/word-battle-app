package com.wordbattle.lesson;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

/**
 * 中央词典表（dictionary）。word 为主键。
 *
 * jsonb 列统一映射为 String（原文）：
 *   - definitions / forms 是真正的 jsonb 数组（原文形如 [{...}]）
 *   - examples / collocations 是 jsonb 字符串（双层编码，原文形如 "[{...}]"）
 *   两者都交给 JsonbHelper 处理（isTextual 时二次解析）。
 *
 * text[] 列（synonyms/antonyms/related）用 SqlTypes.ARRAY 映射为 List<String>。
 */
@Entity
@Table(name = "dictionary")
@Getter
@Setter
public class Dictionary {

    @Id
    @Column(name = "word")
    private String word;

    @Column(name = "pos")
    private String pos;

    @Column(name = "ipa")
    private String ipa;

    @Column(name = "audio_url")
    private String audioUrl;

    /** jsonb 数组：[{pos, gloss}] */
    @Column(name = "definitions")
    private String definitions;

    /** jsonb 字符串（双层编码）：[{text, translation?, ref?}] */
    @Column(name = "examples")
    private String examples;

    /** jsonb 数组：[{form, tags}] */
    @Column(name = "forms")
    private String forms;

    @Column(name = "etymology")
    private String etymology;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "synonyms", columnDefinition = "text[]")
    private List<String> synonyms;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "antonyms", columnDefinition = "text[]")
    private List<String> antonyms;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "related", columnDefinition = "text[]")
    private List<String> related;

    @Column(name = "translation")
    private String translation;

    @Column(name = "frequency")
    private Integer frequency;

    @Column(name = "discrimination")
    private String discrimination;

    /** jsonb 字符串（双层编码）：[{phrase, meaning}] */
    @Column(name = "collocations")
    private String collocations;

    /** jsonb：易混淆词 [{word, meaning}]，meaning 为带词性的中文释义 */
    @Column(name = "confusable")
    private String confusable;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
