package com.wordbattle.pk;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** PK 工具函数测试：速度分、Elo 词力值、房间码、洗牌、短释义。 */
class PkUtilsTest {

    // ---- 速度计分 ----

    @Test
    void pkScore_fullTimeLeft_isHundred() {
        assertEquals(100, PkUtils.calculatePKScore(10000, 10000));
    }

    @Test
    void pkScore_proportional() {
        assertEquals(25, PkUtils.calculatePKScore(2500, 10000));
        assertEquals(0, PkUtils.calculatePKScore(0, 10000));
    }

    @Test
    void pkScore_clamped() {
        assertEquals(0, PkUtils.calculatePKScore(-5, 100));
        assertEquals(100, PkUtils.calculatePKScore(200, 100));
    }

    // ---- Elo 词力值（K=32）----

    @Test
    void elo_equalRanks_winnerPlus16_loserMinus16() {
        assertEquals(1216, PkUtils.calculatePowerWordRank(1200, true, 1200));
        assertEquals(1184, PkUtils.calculatePowerWordRank(1200, false, 1200));
    }

    @Test
    void elo_upsetRewardsMoreThanExpectedWin() {
        // 弱胜强（1000 胜 1400，期望胜率 1/11）≈ +29；强胜弱（期望 10/11）≈ +3
        int upset = PkUtils.calculatePowerWordRank(1000, true, 1400);
        int expected = PkUtils.calculatePowerWordRank(1400, true, 1000);
        assertEquals(1029, upset);
        assertEquals(1403, expected);
        assertTrue(upset - 1000 > expected - 1400);
    }

    @Test
    void elo_neverBelowZero() {
        assertEquals(0, PkUtils.calculatePowerWordRank(0, false, 800));
    }

    // ---- 房间码 ----

    @Test
    void roomCode_isSixAlnumChars() {
        for (int i = 0; i < 50; i++) {
            String code = PkUtils.generateRoomCode();
            assertEquals(6, code.length());
            assertTrue(code.matches("[A-Z0-9]{6}"), code);
        }
    }

    // ---- 洗牌 ----

    @Test
    void shuffle_keepsAllElements() {
        List<Integer> src = List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        List<Integer> out = PkUtils.shuffle(src);
        assertEquals(src.size(), out.size());
        assertEquals(src.stream().sorted().toList(), out.stream().sorted().toList());
        assertEquals(List.of(1, 2, 3), PkUtils.shuffle(List.of(1, 2, 3)).stream().sorted().toList());
    }

    // ---- 短释义 ----

    @Test
    void shortDef_takesFirstSegment_andThreeCommaParts() {
        assertEquals("n. 苹果；水果", PkUtils.shortDef("n. 苹果，水果；a. 苹果树\n[植] 蔷薇科"));
    }

    @Test
    void shortDef_unifiesAPrefixToAdj() {
        assertEquals("adj. 快的", PkUtils.shortDef("a. 快的；迅速的"));
    }

    @Test
    void shortDef_normalizesLiteralBackslashN() {
        // 数据里常见字面 "\n"（反斜杠+n），需按换行切分
        assertEquals("n. 猫", PkUtils.shortDef("n. 猫\\n[动] 猫科动物"));
    }

    @Test
    void shortDef_plainTextPassesThrough() {
        assertEquals("快速的", PkUtils.shortDef("快速的"));
    }

    @Test
    void shortDef_emptyInput() {
        assertEquals("", PkUtils.shortDef(""));
    }

    // ---- 随机数 ----

    @Test
    void randInt_inRange_andDegenerate() {
        for (int i = 0; i < 100; i++) {
            int v = PkUtils.randInt(2, 5);
            assertTrue(v >= 2 && v <= 4, "v=" + v);
        }
        assertEquals(3, PkUtils.randInt(3, 3));
    }
}
