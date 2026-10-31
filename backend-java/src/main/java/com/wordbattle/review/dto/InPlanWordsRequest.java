package com.wordbattle.review.dto;

import java.util.List;

/** 查询哪些词已在复习计划（用于结算页预显"已加入"）。 */
public record InPlanWordsRequest(List<String> words) {
}
