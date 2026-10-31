package com.wordbattle.pk.dto;

/** submitNpcAnswer 响应。 */
public record NpcSubmitResponse(
        SideResult user,
        SideResult npc,
        Integer correctIndex
) {
}
