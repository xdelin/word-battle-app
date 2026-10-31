package com.wordbattle.course.dto;

/**
 * 课程树叶子：单个关卡节点。
 * totalChallenges = 该关卡题目数；isCompleted = 当前用户是否已完成。
 */
public record LessonNode(
        Integer id,
        String title,
        String description,
        Integer order,
        Boolean isBossLesson,
        Integer totalChallenges,
        Boolean isCompleted
) {
}
