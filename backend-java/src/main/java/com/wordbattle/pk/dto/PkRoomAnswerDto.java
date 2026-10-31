package com.wordbattle.pk.dto;

import java.util.List;

/** 房间答题记录（轮询双方进度用）。 */
public record PkRoomAnswerDto(
        String userId,
        String questionId,
        Integer score,
        Boolean isCorrect,
        Integer selectedOption,
        String answeredAt
) {
}
