package com.wordbattle.studyroom.dto;

/** 创建自习室请求。 */
public record CreateRoomRequest(
        String name,
        Boolean isPublic,
        Boolean requireApproval,
        Integer dailyGoal
) {
}
