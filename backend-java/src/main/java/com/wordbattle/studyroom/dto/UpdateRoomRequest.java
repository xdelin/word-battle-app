package com.wordbattle.studyroom.dto;

/** 更新自习室设置（管理员）。所有字段可选，null 表示不改。 */
public record UpdateRoomRequest(
        String name,
        Boolean isPublic,
        Boolean requireApproval,
        Integer dailyGoal
) {
}
