package com.wordbattle.review;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/**
 * FSRS 简化调度单元测试：状态迁移、stability/difficulty 边界、间隔区间。
 * 天级间隔含 ±20% 随机扰动，断言用区间而非精确值。
 */
class FsrsCalculatorTest {

    private static UserCardProgress progress(String state, String stability, String difficulty) {
        UserCardProgress p = new UserCardProgress();
        p.setFsrsState(state);
        p.setFsrsStability(stability);
        p.setFsrsDifficulty(difficulty);
        return p;
    }

    @Test
    void newCardForgot_entersLearning_withMinuteInterval() {
        Instant before = Instant.now();
        FsrsCalculator.Result r = FsrsCalculator.calculate(null, 0);
        assertEquals("learning", r.state());
        assertEquals(0.1, r.stability(), 1e-9);
        assertEquals(1.2, r.difficulty(), 1e-9);
        // 忘记：1 分钟级间隔
        assertTrue(r.due().isAfter(before));
        assertTrue(r.due().isBefore(before.plusSeconds(90)));
        assertEquals(1.0 / (24 * 60), r.interval(), 1e-9);
    }

    @Test
    void newCardGood_entersReview_withDayInterval() {
        Instant before = Instant.now();
        FsrsCalculator.Result r = FsrsCalculator.calculate(null, 2);
        assertEquals("review", r.state());
        assertEquals(1.0, r.stability(), 1e-9);
        // 良好：难度不降到下限以下（初始 1，max(1, 0.9) = 1）
        assertEquals(1.0, r.difficulty(), 1e-9);
        // 良好：1 天 + 0~20% 扰动
        assertTrue(r.interval() >= 1.0 && r.interval() <= 1.2, "interval=" + r.interval());
        assertTrue(r.due().isAfter(before.plusSeconds(86400).minusSeconds(5)));
        assertTrue(r.due().isBefore(before.plusSeconds((long) (1.2 * 24 * 3600) + 5)));
    }

    @Test
    void easyRating_multipliesStability() {
        FsrsCalculator.Result r = FsrsCalculator.calculate(progress("review", "2.0", "3.0"), 3);
        assertEquals("review", r.state());
        assertEquals(4.0, r.stability(), 1e-9);
        assertEquals(2.9, r.difficulty(), 1e-9);
        assertTrue(r.interval() >= 3.0 && r.interval() <= 3.6, "interval=" + r.interval());
    }

    @Test
    void hardRating_growsDifficulty_andShrinksStability() {
        FsrsCalculator.Result r = FsrsCalculator.calculate(progress("review", "2.0", "3.0"), 1);
        assertEquals("learning", r.state());
        assertEquals(1.0, r.stability(), 1e-9);
        assertEquals(3.2, r.difficulty(), 1e-9);
        // 困难：10 分钟级间隔
        assertTrue(r.interval() < 1, "困难应为分钟级间隔, got " + r.interval());
    }

    @Test
    void difficulty_clampedToBounds() {
        // 上限 10
        FsrsCalculator.Result up = FsrsCalculator.calculate(progress("review", "1.0", "9.9"), 0);
        assertEquals(10.0, up.difficulty(), 1e-9);
        // 下限 1
        FsrsCalculator.Result down = FsrsCalculator.calculate(progress("review", "1.0", "1.0"), 2);
        assertEquals(1.0, down.difficulty(), 1e-9);
    }

    @Test
    void stability_clampedToMinimum_andUnparseableFieldsDefaultToZero() {
        // stability 解析失败按 0 处理，乘完后 clamp 到 0.1
        FsrsCalculator.Result r = FsrsCalculator.calculate(progress("review", "abc", "1.0"), 2);
        assertEquals(0.1, r.stability(), 1e-9);
        // 已有极小 stability：0.05 * 0.1 = 0.005 -> clamp 0.1
        FsrsCalculator.Result tiny = FsrsCalculator.calculate(progress("review", "0.05", "1.0"), 0);
        assertEquals(0.1, tiny.stability(), 1e-9);
    }

    @Test
    void stability_floorNeverBelowPointOne_forRepeatedForgot() {
        FsrsCalculator.Result r = FsrsCalculator.calculate(progress("learning", "0.2", "5.0"), 0);
        assertEquals(Math.max(0.1, 0.2 * 0.1), r.stability(), 1e-9);
    }
}
