package com.wordbattle.lesson.dto;

import java.util.List;

public record FormDto(
        String form,
        List<String> tags
) {
}
