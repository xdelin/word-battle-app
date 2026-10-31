package com.wordbattle.lesson.dto;

import java.util.List;

/**
 * 关卡详情：关卡元信息 + 组装好的题目列表（含选项与单词富字段卡）。
 * 前端 lesson 页拿到后直接传给 LessonQuiz，无需再做 cards/dictionary 二次查询。
 */
public record LessonDetailResponse(
        Integer id,
        String title,
        String description,
        List<QuestionDto> questions
) {
}
