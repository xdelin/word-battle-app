package com.wordbattle.pk;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.regex.Pattern;

/**
 * PK 工具函数。1:1 复刻 lib/utils.ts 与 actions/pk-actions.ts 里的工具方法。
 */
public final class PkUtils {

    private static final Random RNG = new Random();
    private static final String ROOM_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    // a. -> adj.（ECDICT 用 a. 表示形容词，统一为 adj.）
    private static final Pattern A_PREFIX = Pattern.compile("^a\\.\\s*", Pattern.CASE_INSENSITIVE);
    // 去 [..] 方括号标注（如 [经] [医]）
    private static final Pattern BRACKET = Pattern.compile("\\[[^]]+]");

    public static final String NPC_USER_ID = "00000000-0000-0000-0000-000000000001";
    public static final String NPC_USER_NAME = "NPC 小词";
    public static final double NPC_CORRECT_RATE = 0.75;
    public static final int NPC_MIN_DELAY_MS = 1500;
    public static final int NPC_MAX_DELAY_MS = 3500;

    private PkUtils() {}

    /** 生成 6 位房间码（A-Z0-9）。 */
    public static String generateRoomCode() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(ROOM_CHARS.charAt(RNG.nextInt(ROOM_CHARS.length())));
        }
        return sb.toString();
    }

    /** Fisher-Yates 洗牌（返回新列表）。 */
    public static <T> List<T> shuffle(List<T> list) {
        List<T> s = new ArrayList<>(list);
        for (int i = s.size() - 1; i > 0; i--) {
            int j = RNG.nextInt(i + 1);
            T tmp = s.get(i);
            s.set(i, s.get(j));
            s.set(j, tmp);
        }
        return s;
    }

    /** 速度计分：剩余时间占比 * 100，clamp 0-100。 */
    public static int calculatePKScore(int timeLeft, int totalTime) {
        double speedBonus = ((double) timeLeft / totalTime) * 100;
        return Math.max(0, Math.min(100, (int) Math.round(speedBonus)));
    }

    /**
     * 取短中文释义。1:1 对齐 scripts/import-exam-words.ts 的 shortDefinition：
     *   - 字面 "\n"（反斜杠+n）归一成换行，避免带进选项
     *   - 去 [..] 方括号标注（如 [经] [医]）
     *   - 按 ;；\n 切第一段
     *   - 保留词性前缀（n./v./vt. 等），仅把 a. 归一为 adj.
     *   - 取前 3 个逗号项用"；"连接
     */
    public static String shortDef(String translation) {
        if (translation == null || translation.isEmpty()) return "";
        // 字面 \n -> 真换行
        String norm = translation.replace("\\n", "\n").replace("\r", "\n");
        // 去 [..]，按 ;；\n 切第一段
        String first = BRACKET.matcher(norm).replaceAll("").split("[;；\n]")[0].trim();
        // a. -> adj.（其他词性前缀保留）
        String unified = A_PREFIX.matcher(first).replaceFirst("adj. ");
        // 取前 3 个逗号项（中英文逗号都切）
        String[] parts = unified.split("[，,]");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(3, parts.length); i++) {
            if (i > 0) sb.append("；");
            sb.append(parts[i].trim());
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? norm.replaceAll("\\s+", " ").trim().substring(0, Math.min(36, norm.length())) : result;
    }

    /** Elo 词力值计算（K=32）。 */
    public static int calculatePowerWordRank(int currentRank, boolean won, int opponentRank) {
        int K = 32;
        double expected = 1.0 / (1 + Math.pow(10, (opponentRank - currentRank) / 400.0));
        double actual = won ? 1 : 0;
        double newRank = currentRank + K * (actual - expected);
        return Math.max(0, (int) Math.round(newRank));
    }

    /** nextInt(minInclusive, maxExclusive)。 */
    public static int randInt(int min, int max) {
        return min + RNG.nextInt(Math.max(1, max - min));
    }
}
