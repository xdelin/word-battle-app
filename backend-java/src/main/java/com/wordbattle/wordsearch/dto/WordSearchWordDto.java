package com.wordbattle.wordsearch.dto;

/**
 * 找词游戏词条：英文单词 + 截短后的中文释义（侧栏提示用）。
 */
public record WordSearchWordDto(
        String word,
        String translation
) {
}
