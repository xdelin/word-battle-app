package com.wordbattle.user.dto;

/**
 * 用户设置（前端所需字段子集）。
 */
public record UserSettingsResponse(
        String userId,
        Integer dailyGoalLessons,
        Integer dailyGoalMinutes
) {
    public static UserSettingsResponse from(com.wordbattle.user.UserSettings s) {
        return new UserSettingsResponse(
                s.getUserId().toString(),
                s.getDailyGoalLessons() != null ? s.getDailyGoalLessons() : 5,
                s.getDailyGoalMinutes() != null ? s.getDailyGoalMinutes() : 15
        );
    }

    /** 用户设置行不存在时的默认值（与前端 getUserSettings 默认一致）。 */
    public static UserSettingsResponse defaultFor(String userId) {
        return new UserSettingsResponse(userId, 5, 15);
    }
}
