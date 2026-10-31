package com.wordbattle.review;

/**
 * 复习卡片投影（原生 SQL）。字段别名须与 SQL alias 一致。
 * 含 cards 行 + dictionary 富字段 + user_card_progress 行（到期卡才有）。
 */
public interface ReviewCardProjection {
    // cards
    java.util.UUID getCardId();
    String getWord();
    Integer getBookId();
    Integer getDifficulty();
    String[] getTags();
    // dictionary（可空）
    String getPos();
    String getIpa();
    String getAudioUrl();
    String getDefinitions();   // jsonb 原文
    String getExamples();      // jsonb 原文（双层编码）
    String getForms();         // jsonb 原文
    String getEtymology();
    String[] getSynonyms();
    String[] getAntonyms();
    String[] getRelated();
    String getTranslation();
    Integer getFrequency();
    String getDiscrimination();
    String getCollocations();  // jsonb 原文（双层编码）
    String getConfusable();    // jsonb 原文（双层编码）：易混淆词
    // user_card_progress（全新卡为 null）
    java.time.Instant getFsrsDueDate();
    Integer getTotalReviews();
    Integer getTotalCorrect();
}
