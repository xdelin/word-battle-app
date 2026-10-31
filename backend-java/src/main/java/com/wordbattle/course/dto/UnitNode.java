package com.wordbattle.course.dto;

import java.util.List;

public record UnitNode(
        Integer id,
        String title,
        String description,
        Integer order,
        List<LessonNode> lessons
) {
}
