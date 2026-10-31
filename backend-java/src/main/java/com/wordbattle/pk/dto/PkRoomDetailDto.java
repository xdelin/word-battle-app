package com.wordbattle.pk.dto;

import java.util.List;

/** getPKRoom 返回：房间 + 玩家 + 题目。 */
public record PkRoomDetailDto(
        PkRoomDto room,
        List<PkRoomUserDto> users,
        List<PkQuestionDto> questions
) {
}
