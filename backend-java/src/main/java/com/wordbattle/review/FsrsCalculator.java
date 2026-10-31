package com.wordbattle.review;

import java.time.Instant;
import java.util.UUID;

/**
 * FSRS 简化版调度。1:1 复刻前端 app/api/review/route.ts 的 calculateFSRS：
 *   - 按评分（0忘记/1困难/2良好/3简单）给固定 stability 乘数与间隔
 *   - intervalMinutes 用于 0/1（学习态），intervalDays 用于 2/3（复习态）
 *   - intervalDays 加 ±20% 随机扰动（与前端一致）
 *   - state: rating<=1 -> learning；>=2 -> review
 *   - difficulty: 答难(+0.2 上限10) / 答易(-0.2 下限1)
 *
 * 注：这不是完整 FSRS-6（lib/fsrs/scheduler.ts 那套），而是 route 里实际在用的简化版。
 * 复习页与加入复习都走这套，保证与现有数据一致。
 */
public class FsrsCalculator {

    private static final java.util.Random RNG = new java.util.Random();

    private static final double[][] RATING_CONFIG = {
            // {stabilityMultiplier, intervalMinutes(学习态, -1 表示用天), intervalDays(复习态, -1 表示用分), xp}
            {0.1, 1,   -1, 0},   // 0 忘记
            {0.5, 10,  -1, 5},   // 1 困难
            {1.0, -1,  1,  10},  // 2 良好
            {2.0, -1,  3,  15},  // 3 简单
    };

    public static Result calculate(UserCardProgress progress, int rating) {
        Instant now = Instant.now();
        String prevState = (progress != null && progress.getFsrsState() != null) ? progress.getFsrsState() : "new";
        double stability = (progress != null && progress.getFsrsStability() != null) ? safeParse(progress.getFsrsStability()) : 0;
        double difficulty = (progress != null && progress.getFsrsDifficulty() != null) ? safeParse(progress.getFsrsDifficulty()) : 1;

        double[] cfg = RATING_CONFIG[rating];
        double stabilityMultiplier = cfg[0];
        int intervalMinutes = (int) cfg[1];
        int intervalDays = (int) cfg[2];

        if ("new".equals(prevState)) {
            stability = 1.0 * stabilityMultiplier;
        } else {
            stability = Math.max(0.1, stability * stabilityMultiplier);
        }

        if (rating <= 1) {
            difficulty = Math.min(10, difficulty + 0.2);
        } else {
            difficulty = Math.max(1, difficulty - 0.1);
        }

        double interval;
        Instant due;
        if (intervalMinutes >= 0) {
            // 学习态：分钟级间隔
            interval = intervalMinutes / (24.0 * 60);
            due = now.plusSeconds(intervalMinutes * 60L);
        } else {
            // 复习态：天级间隔 + ±20% 扰动
            double days = intervalDays * (1 + RNG.nextDouble() * 0.2);
            interval = days;
            due = now.plusMillis((long) (days * 24 * 60 * 60 * 1000L));
        }

        String newState = (rating <= 1) ? "learning" : "review";
        return new Result(newState, stability, difficulty, due, interval);
    }

    private static double safeParse(String s) {
        try {
            return Double.parseDouble(s);
        } catch (Exception e) {
            return 0;
        }
    }

    /** FSRS 计算结果。due 为到期时刻，interval 为天数（小数）。 */
    public record Result(
            String state,
            double stability,
            double difficulty,
            Instant due,
            double interval
    ) {
    }

    /** 生成新的进度行 id（DB 无默认值，需应用层提供）。 */
    public static UUID newProgressId() {
        return UUID.randomUUID();
    }
}
