package com.wordbattle.checkin;

import com.wordbattle.user.CurrentUserResolver;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * BitMap 签到。
 *
 * key：sign:{userId}:{yyyyMM}，offset = 当月第几天 - 1（1 号 -> 0）。
 * 每天只占 1 bit：一个月最多 31 bit（约 4 字节），一年约 46 字节，
 * 对比"一用户一行"的签到表（一年 365 行）节省两个数量级的存储。
 *
 * 累计天数用独立计数器 sign:total:{userId} 增量维护：SETBIT 返回置位前的旧值，
 * 只有旧值为 0（当天首次签到）才 INCR —— 天然防并发重复累计，也避免跨月统计逐月 BITCOUNT。
 * 计数器缺失时（如 Redis 清库）回退为扫描近 12 个月的 BITCOUNT，保证口径可用。
 *
 * 连续天数为纯函数 {@link #consecutiveDays}，可直接单测。
 */
@Service
public class CheckinService {

    /** 连续天数回看窗口：62 天足够跨两个月。窗口外断签本来 streak 也已归零。 */
    static final int STREAK_WINDOW_DAYS = 62;

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    private final StringRedisTemplate redis;
    private final CurrentUserResolver currentUser;

    public CheckinService(StringRedisTemplate redis, CurrentUserResolver currentUser) {
        this.redis = redis;
        this.currentUser = currentUser;
    }

    /** 今日签到。重复签到不报错，justChecked=false 原样返回状态。 */
    public CheckinResponse checkin() {
        String userId = currentUser.getUserId();
        LocalDate today = LocalDate.now();
        try {
            Boolean prev = redis.opsForValue().setBit(monthKey(userId, YearMonth.from(today)), today.getDayOfMonth() - 1L, true);
            boolean firstTimeToday = Boolean.FALSE.equals(prev); // 置位前是 0 -> 今天第一次签
            if (firstTimeToday) {
                redis.opsForValue().increment(totalKey(userId));
            }
            return statusOf(userId, today, firstTimeToday);
        } catch (Exception e) {
            // 签到是写操作：Redis 不可用时宁可报错重试，也不静默丢签到
            throw new IllegalStateException("签到服务暂不可用，请稍后重试", e);
        }
    }

    /** 当前签到状态（不落写操作）。 */
    public CheckinResponse status() {
        String userId = currentUser.getUserId();
        try {
            return statusOf(userId, LocalDate.now(), false);
        } catch (Exception e) {
            throw new IllegalStateException("签到服务暂不可用", e);
        }
    }

    /** 累计签到天数（user_stats 接口用）。Redis 不可用返回 0，不打断主流程。 */
    public long totalStudyDays() {
        try {
            return totalDays(currentUser.getUserId());
        } catch (Exception e) {
            return 0;
        }
    }

    /** 当前连续签到天数。Redis 不可用返回 0。 */
    public int consecutiveDays() {
        try {
            return streakOf(currentUser.getUserId(), LocalDate.now());
        } catch (Exception e) {
            return 0;
        }
    }

    // ============ 内部实现 ============

    private CheckinResponse statusOf(String userId, LocalDate today, boolean justChecked) {
        String key = monthKey(userId, YearMonth.from(today));
        boolean checkedToday = Boolean.TRUE.equals(redis.opsForValue().getBit(key, today.getDayOfMonth() - 1L));
        long total = totalDays(userId);
        long monthDays = bitCount(key);
        List<Integer> checkedDays = monthCheckedDays(userId, YearMonth.from(today));
        return new CheckinResponse(justChecked, checkedToday, total, streakOf(userId, today), monthDays, checkedDays);
    }

    private long totalDays(String userId) {
        String v = redis.opsForValue().get(totalKey(userId));
        if (v != null) return Long.parseLong(v);
        // 计数器缺失：回退扫描近 12 个月的 BITCOUNT（只读，不回写）
        long sum = 0;
        YearMonth ym = YearMonth.now();
        for (int i = 0; i < 12; i++) {
            sum += bitCount(monthKey(userId, ym.minusMonths(i)));
        }
        return sum;
    }

    private int streakOf(String userId, LocalDate today) {
        // 一次 pipeline 取回窗口内每天的 bit，避免逐天 GETBIT 的往返
        List<Object> bits = redis.executePipelined((RedisCallback<Object>) conn -> {
            for (int i = 0; i < STREAK_WINDOW_DAYS; i++) {
                LocalDate d = today.minusDays(STREAK_WINDOW_DAYS - 1L - i); // i=0 最旧，i=WINDOW-1 今天
                byte[] k = monthKey(userId, YearMonth.from(d)).getBytes(StandardCharsets.UTF_8);
                conn.stringCommands().getBit(k, d.getDayOfMonth() - 1L);
            }
            return null;
        });
        boolean[] window = new boolean[STREAK_WINDOW_DAYS];
        for (int i = 0; i < STREAK_WINDOW_DAYS; i++) {
            window[i] = Boolean.TRUE.equals(bits.get(i));
        }
        return consecutiveDays(window);
    }

    private long bitCount(String key) {
        Long n = redis.execute((RedisCallback<Long>) conn ->
                conn.stringCommands().bitCount(key.getBytes(StandardCharsets.UTF_8)));
        return n == null ? 0 : n;
    }

    /** 本月已签到的"几号"列表（前端日历渲染用），pipeline 一次取全月。 */
    private List<Integer> monthCheckedDays(String userId, YearMonth ym) {
        byte[] key = monthKey(userId, ym).getBytes(StandardCharsets.UTF_8);
        int len = ym.lengthOfMonth();
        List<Object> bits = redis.executePipelined((RedisCallback<Object>) conn -> {
            for (int day = 1; day <= len; day++) {
                conn.stringCommands().getBit(key, day - 1L);
            }
            return null;
        });
        List<Integer> out = new ArrayList<>();
        for (int day = 1; day <= len; day++) {
            if (Boolean.TRUE.equals(bits.get(day - 1))) out.add(day);
        }
        return out;
    }

    private String monthKey(String userId, YearMonth ym) {
        return "sign:" + userId + ":" + ym.format(YM);
    }

    private String totalKey(String userId) {
        return "sign:total:" + userId;
    }

    /**
     * 连续签到天数（纯函数，便于单测）。
     * 约定：今天没签不断签 —— streak 从昨天往前数（业界常见口径，避免"还没签就清零"）。
     *
     * @param oldestToToday 按时间从旧到新的签到序列，最后一个元素是今天
     */
    public static int consecutiveDays(boolean[] oldestToToday) {
        int end = oldestToToday.length - 1;
        if (end < 0) return 0;
        if (!oldestToToday[end]) end -= 1; // 今天没签：看截止昨天的连签
        int streak = 0;
        for (int i = end; i >= 0; i--) {
            if (!oldestToToday[i]) break;
            streak++;
        }
        return streak;
    }
}
