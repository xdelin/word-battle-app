package com.wordbattle.lesson.dto;

import java.util.List;

public record CardDto(
        String word,
        String phonetic,
        String translation,
        String example,
        List<ExampleDto> examples,
        String audioUrl,
        List<String> tags,
        Integer difficulty,
        List<DefinitionDto> definitions,
        String etymology,
        List<FormDto> forms,
        List<String> synonyms,
        List<String> antonyms,
        List<String> related,
        Integer frequency,
        String discrimination,
        List<CollocationDto> collocations,
        List<ConfusableDto> confusable
) {
}
