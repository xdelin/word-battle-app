package com.wordbattle.review.dto;

import java.util.List;

/**
 * 复习页单词卡。字段与前端 WordCardData 对齐（examples/collocations 已解析为数组）。
 */
public record ReviewCardDto(
        String id,                 // card id (uuid)
        String word,
        String phonetic,           // dictionary.ipa
        String translation,
        String example,            // examples[0].text
        String audioUrl,
        List<String> tags,
        Integer difficulty,
        List<com.wordbattle.lesson.dto.DefinitionDto> definitions,
        List<com.wordbattle.lesson.dto.ExampleDto> examples,
        String etymology,
        List<com.wordbattle.lesson.dto.FormDto> forms,
        List<String> synonyms,
        List<String> antonyms,
        List<String> related,
        Integer frequency,
        String discrimination,
        List<com.wordbattle.lesson.dto.CollocationDto> collocations,
        List<com.wordbattle.lesson.dto.ConfusableDto> confusable
) {
}
