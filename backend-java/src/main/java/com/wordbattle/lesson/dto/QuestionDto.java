package com.wordbattle.lesson.dto;

import java.util.List;

public record QuestionDto(
        Integer id,
        Integer challengeId,
        String type,
        String question,
        List<OptionDto> options,
        CardDto card
) {
}
