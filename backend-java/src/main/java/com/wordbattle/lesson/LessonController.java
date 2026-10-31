package com.wordbattle.lesson;

import com.wordbattle.common.ApiResult;
import com.wordbattle.lesson.dto.LessonDetailResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/lessons")
public class LessonController {

    private final LessonService lessonService;

    public LessonController(LessonService lessonService) {
        this.lessonService = lessonService;
    }

    /** 关卡详情：题目 + 选项 + 单词富字段卡（已组装，前端可直接渲染）。 */
    @GetMapping("/{id}")
    public ApiResult<LessonDetailResponse> getLesson(@PathVariable Integer id) {
        return ApiResult.ok(lessonService.getLessonDetail(id));
    }
}
