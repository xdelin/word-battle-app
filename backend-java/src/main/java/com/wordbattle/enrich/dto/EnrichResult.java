package com.wordbattle.enrich.dto;

import java.util.List;

/** LLM 输出的单词 enrich 结果。 */
public record EnrichResult(
        String word,
        String example_en,
        String example_cn,
        List<Collocation> collocations,
        String discrimination
) {
    public record Collocation(String phrase, String meaning) {
    }
}
