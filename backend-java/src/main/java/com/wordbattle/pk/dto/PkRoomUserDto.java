package com.wordbattle.pk.dto;

/** 房间内玩家。 */
public record PkRoomUserDto(
        String userId,
        Boolean isHost,
        Integer totalScore,
        Integer correctCount
) {
}
