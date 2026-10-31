package com.wordbattle.review.dto;

import java.util.List;

/** 按词批量查字典富字段（结算页词卡预取）。 */
public record WordsDetailRequest(List<String> words) {
}
