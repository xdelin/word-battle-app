package com.wordbattle.review;

import com.wordbattle.common.ApiResult;
import com.wordbattle.review.dto.AddToReviewRequest;
import com.wordbattle.review.dto.InPlanWordsRequest;
import com.wordbattle.review.dto.InPlanWordsResponse;
import com.wordbattle.review.dto.MasterWordRequest;
import com.wordbattle.review.dto.ReviewCardDto;
import com.wordbattle.review.dto.ReviewQueueResponse;
import com.wordbattle.review.dto.ReviewRatingRequest;
import com.wordbattle.review.dto.ReviewRatingResponse;
import com.wordbattle.review.dto.WordsDetailRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/review")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    /** 复习队列（到期 + 全新补足，限 20）。 */
    @GetMapping
    public ApiResult<ReviewQueueResponse> getQueue() {
        return ApiResult.ok(reviewService.getDueQueue());
    }

    /** 提交评分，返回下次复习时间。 */
    @PostMapping
    public ApiResult<ReviewRatingResponse> submitRating(@Valid @RequestBody ReviewRatingRequest req) {
        return ApiResult.ok(reviewService.submitRating(req));
    }

    /** 加入复习计划（闯关页答错/手动）。返回 status: added/reactivated/already-due/not-found。 */
    @PostMapping("/add-word")
    public ApiResult<Map<String, String>> addWord(@Valid @RequestBody AddToReviewRequest req) {
        String status = reviewService.addWordToReviewPlan(req);
        return ApiResult.ok(Map.of("status", status, "success", "not-found".equals(status) ? "false" : "true"));
    }

    /** 标记单词为已熟记（写熟悉列表 + 移出复习计划）。 */
    @PostMapping("/master")
    public ApiResult<Void> master(@Valid @RequestBody MasterWordRequest req) {
        reviewService.masterWord(req);
        return ApiResult.ok();
    }

    /** 查询给定词表里哪些已在复习计划（结算页预显"已加入"）。 */
    @PostMapping("/in-plan")
    public ApiResult<InPlanWordsResponse> inPlan(@RequestBody InPlanWordsRequest req) {
        return ApiResult.ok(reviewService.getWordsInPlan(req.words()));
    }

    /** 按词批量查字典富字段（结算页词卡预取，前端 WordCard 直接消费）。 */
    @PostMapping("/words-detail")
    public ApiResult<List<ReviewCardDto>> wordsDetail(@RequestBody WordsDetailRequest req) {
        return ApiResult.ok(reviewService.getWordsDetail(req.words()));
    }
}
