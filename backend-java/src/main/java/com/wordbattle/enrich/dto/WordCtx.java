package com.wordbattle.enrich.dto;

/** 待 enrich 的词上下文（输入 LLM 用）。 */
public record WordCtx(
        String word,
        String pos,
        String translation
) {
}
