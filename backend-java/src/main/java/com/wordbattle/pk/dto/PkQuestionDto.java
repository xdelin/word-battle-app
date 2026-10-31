package com.wordbattle.pk.dto;

import java.util.List;

/** PK 题目（前端消费）。options 为 {text, enDefinition} 对象数组，phonetic 为题干音标。 */
public record PkQuestionDto(
        String id,
        Integer questionIndex,
        String question,
        List<PkOptionDto> options,
        Integer correctIndex,
        String phonetic
) {
}
