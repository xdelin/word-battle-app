package com.wordbattle.pk.dto;

import java.time.Instant;

/** PK 房间（前端 waiting 阶段用）。 */
public record PkRoomDto(
        String id,
        String roomCode,
        String type,
        String status,
        Integer bookId,
        Integer questionCount,
        Integer timePerQuestion,
        Instant startedAt
) {
}
