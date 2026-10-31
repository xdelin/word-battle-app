package com.wordbattle.review.dto;

import java.util.List;

/** 复习计划内查询结果：当前用户 id + 在计划中的词子集。 */
public record InPlanWordsResponse(String userId, List<String> words) {
}
