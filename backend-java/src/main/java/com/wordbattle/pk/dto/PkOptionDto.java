package com.wordbattle.pk.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * PK 题目选项：中文释义 + 英文释义（前端可切换显示）。
 * 与学习页 OptionDto 不同：PK 用 correctIndex 标记正确项，无需 per-option isCorrect/id。
 */
public record PkOptionDto(
        @JsonProperty("text") String text,
        @JsonProperty("enDefinition") String enDefinition
) {
    /** 兼容旧构造（无英文释义）。 */
    public PkOptionDto(String text) {
        this(text, null);
    }
}
