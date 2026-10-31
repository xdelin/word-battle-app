package com.wordbattle.studyroom.dto;

import java.util.List;

/** 自习室详情（含成员列表 + 当前用户是否管理员 + 当前用户 id）。 */
public record RoomDetailDto(
        StudyRoomDto room,
        List<StudyRoomMemberDto> members,
        Boolean currentUserIsAdmin,
        String currentUserId
) {
}
