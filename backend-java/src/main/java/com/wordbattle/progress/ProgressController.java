package com.wordbattle.progress;

import com.wordbattle.common.ApiResult;
import com.wordbattle.progress.dto.ChallengeProgressRequest;
import com.wordbattle.progress.dto.LessonProgressRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    /** 记录单题答题进度（答错扣 1 心）。 */
    @PostMapping("/challenge")
    public ApiResult<Void> recordChallenge(@Valid @RequestBody ChallengeProgressRequest req) {
        progressService.updateChallengeProgress(req);
        return ApiResult.ok();
    }

    /** 记录关卡进度（完成则累加经验与掌握词）。 */
    @PostMapping("/lesson")
    public ApiResult<Void> recordLesson(@Valid @RequestBody LessonProgressRequest req) {
        progressService.updateLessonProgress(req);
        return ApiResult.ok();
    }
}
