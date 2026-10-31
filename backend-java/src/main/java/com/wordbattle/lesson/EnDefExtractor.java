package com.wordbattle.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.wordbattle.lesson.dto.DefinitionDto;

import java.util.List;

/**
 * 从 Dictionary.definitions 提取英文释义（按词性匹配，取第一段，以 ; 或 . 结束）。
 * 学习页与 PK 共用：给题目选项配英文释义，供前端中/英文释义切换。
 */
public final class EnDefExtractor {

    private static final TypeReference<List<DefinitionDto>> DEFS = new TypeReference<>() {};

    private EnDefExtractor() {}

    /** 从 Dictionary 取英文释义（学习页用）。 */
    public static String extractEnDefinition(Dictionary dict, String cnPos, JsonbHelper jsonb) {
        return dict == null ? null : extractEnDefinition(dict.getDefinitions(), cnPos, jsonb);
    }

    /** 选项栏能容纳的英文释义最长字符数（含词性前缀）。超出则换段或截断。 */
    private static final int MAX_EN_DEF_LEN = 120;

    /** 从 definitions 原文（jsonb text）取英文释义（PK 用，findCandidates 直接取列）。
     *  词性匹配：收集所有与中文词性同类的 def（vt./vi. 匹配 verb 等），把各自 gloss 按分号切段，
     *  按顺序找第一段长度 <= MAX_EN_DEF_LEN 的；都超长则截断第一段并加省略号。 */
    public static String extractEnDefinition(String definitionsRaw, String cnPos, JsonbHelper jsonb) {
        if (definitionsRaw == null || definitionsRaw.isBlank()) return null;
        List<DefinitionDto> defs = jsonb.parse(definitionsRaw, DEFS);
        if (defs == null || defs.isEmpty()) return null;

        String cnPosNorm = (cnPos != null && !cnPos.isBlank()) ? cnPos.trim().toLowerCase() : null;
        // 词性前缀（优先用中文释义的词性，保证中英一致）
        String posPrefix = cnPosNorm != null ? cnPos.trim() : normalizePos(defs.get(0).pos());
        boolean hasPrefix = posPrefix != null && !posPrefix.isBlank();
        int budget = MAX_EN_DEF_LEN - (hasPrefix ? posPrefix.length() + 1 : 0);

        // 收集同词性 def 的 gloss 段；无 cnPos 则收集全部
        List<String> segments = new java.util.ArrayList<>();
        for (DefinitionDto d : defs) {
            boolean samePos = cnPosNorm != null && posMatches(cnPosNorm, normalizePos(d.pos()));
            if (cnPosNorm != null && !samePos) continue;
            String gloss = d.gloss();
            if (gloss == null || gloss.isBlank()) continue;
            for (String seg : gloss.split(";")) {
                String s = seg.trim();
                if (s.isEmpty()) continue;
                if (s.endsWith(".")) s = s.substring(0, s.length() - 1).trim();
                segments.add(s);
            }
        }
        // 无同词性段：fallback 到全部 def 段
        if (segments.isEmpty()) {
            for (DefinitionDto d : defs) {
                String gloss = d.gloss();
                if (gloss == null || gloss.isBlank()) continue;
                for (String seg : gloss.split(";")) {
                    String s = seg.trim();
                    if (s.isEmpty()) continue;
                    if (s.endsWith(".")) s = s.substring(0, s.length() - 1).trim();
                    segments.add(s);
                }
            }
        }
        if (segments.isEmpty()) return hasPrefix ? posPrefix : null;

        // 找第一个长度合适的段
        for (String s : segments) {
            if (s.length() <= budget) {
                return hasPrefix ? posPrefix + " " + s : s;
            }
        }
        // 所有段都超长：截断第一段
        String first = segments.get(0);
        String truncated = first.length() > budget
                ? first.substring(0, Math.max(0, budget - 1)).trim() + "…"
                : first;
        return hasPrefix ? posPrefix + " " + truncated : truncated;
    }

    /** 判断中文词性和英文词性是否匹配（adj. <-> adjective, n. <-> noun, vt./vi. <-> verb 等）。 */
    public static boolean posMatches(String cnPos, String enPos) {
        if (cnPos == null || enPos == null) return false;
        if (cnPos.equalsIgnoreCase(enPos)) return true;
        if (cnPos.startsWith("adj") && enPos.startsWith("adj")) return true;
        if (cnPos.startsWith("adv") && enPos.startsWith("adv")) return true;
        if (isVerbPos(cnPos) && isVerbPos(enPos)) return true;   // v./vt./vi. 互通
        if (cnPos.startsWith("n.") && enPos.startsWith("n.")) return true;
        return false;
    }

    /** 是否动词类词性（v./vt./vi.）。 */
    private static boolean isVerbPos(String p) {
        return p != null && (p.startsWith("v.") || p.startsWith("vt") || p.startsWith("vi"));
    }

    /** 从中文释义文本提取词性前缀（如 "adj. 丰富的" -> "adj."）。 */
    public static String extractPosFromText(String text) {
        if (text == null || text.isBlank()) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("^(n\\.|v\\.|vt\\.|vi\\.|adj\\.|adv\\.|prep\\.|conj\\.|pron\\.|art\\.|num\\.|int\\.|aux\\.)", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(text.trim());
        return m.find() ? m.group(1) : null;
    }

    /** 词性归一化（noun->n., verb->v., adjective->adj. 等）。 */
    public static String normalizePos(String raw) {
        if (raw == null) return null;
        String p = raw.trim().toLowerCase();
        return switch (p) {
            case "noun" -> "n.";
            case "verb" -> "v.";
            case "transitive verb" -> "vt.";
            case "intransitive verb" -> "vi.";
            case "adjective", "a" -> "adj.";
            case "adverb", "adv" -> "adv.";
            case "preposition" -> "prep.";
            case "conjunction" -> "conj.";
            case "pronoun" -> "pron.";
            case "interjection" -> "int.";
            case "article" -> "art.";
            case "numeral" -> "num.";
            default -> p.isEmpty() ? null : p + ".";
        };
    }
}
