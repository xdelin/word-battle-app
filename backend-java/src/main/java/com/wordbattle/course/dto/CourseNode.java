package com.wordbattle.course.dto;

import java.util.List;

public record CourseNode(
        Integer id,
        String title,
        String description,
        Integer order,
        List<UnitNode> units
) {
}
