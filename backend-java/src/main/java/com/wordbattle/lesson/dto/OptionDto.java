package com.wordbattle.lesson.dto;

public record OptionDto(
        Integer id,
        String text,
        Boolean isCorrect,
        String word,           // 该选项对应的英文词（正确项=题目词，干扰项=混淆词）
        String enDefinition   // 英文释义（按词性取第一个，以分号/句号结束）
) {
    // 兼容旧构造（无 word/enDefinition）
    public OptionDto(Integer id, String text, Boolean isCorrect) {
        this(id, text, isCorrect, null, null);
    }
}
