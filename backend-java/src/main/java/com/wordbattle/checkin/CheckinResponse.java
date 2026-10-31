package com.wordbattle.checkin;

import java.util.List;

/** 签到状态 / 签到结果共用 DTO。 */
public record CheckinResponse(
        boolean justChecked,
        boolean checkedToday,
        long totalDays,
        int consecutiveDays,
        long monthDays,
        /** 本月已签到的"几号"列表，前端日历渲染用。 */
        List<Integer> checkedDays
) {
}
