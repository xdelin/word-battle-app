package com.wordbattle.pk.dto;

import java.util.List;

/** NPC 对战开局响应。 */
public record StartNpcResponse(
        PkRoomDto room,
        String npcUserId,
        String npcName,
        List<PkQuestionDto> questions
) {
}
