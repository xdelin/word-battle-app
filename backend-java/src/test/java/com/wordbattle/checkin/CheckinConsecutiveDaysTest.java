package com.wordbattle.checkin;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 连续签到天数纯函数测试（t=已签 f=未签，序列从旧到新，末位是今天）。 */
class CheckinConsecutiveDaysTest {

    @Test
    void empty_isZero() {
        assertEquals(0, CheckinService.consecutiveDays(new boolean[0]));
    }

    @Test
    void allChecked_countsFullWindow() {
        assertEquals(5, CheckinService.consecutiveDays(new boolean[]{true, true, true, true, true}));
    }

    @Test
    void breakInMiddle_countsFromBreak() {
        // 前天断签：今天、昨天连签 -> 2
        assertEquals(2, CheckinService.consecutiveDays(new boolean[]{true, false, true, true}));
    }

    @Test
    void todayUnchecked_streakContinuesFromYesterday() {
        // 今天还没签：不算断签，从昨天起算 -> 3
        assertEquals(3, CheckinService.consecutiveDays(new boolean[]{true, true, true, false}));
    }

    @Test
    void yesterdayUncheckedAndTodayUnchecked_isZero() {
        assertEquals(0, CheckinService.consecutiveDays(new boolean[]{true, true, false, false}));
    }

    @Test
    void todayCheckedButYesterdayBroken_isOne() {
        assertEquals(1, CheckinService.consecutiveDays(new boolean[]{true, false, true}));
    }

    @Test
    void noneEverChecked_isZero() {
        assertEquals(0, CheckinService.consecutiveDays(new boolean[]{false, false, false}));
    }
}
