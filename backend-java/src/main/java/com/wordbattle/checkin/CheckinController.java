package com.wordbattle.checkin;

import com.wordbattle.common.ApiResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 签到（Redis BitMap）：POST 签到，GET 查状态。当前用户从 Authorization JWT 解析。 */
@RestController
@RequestMapping("/api/users/me")
public class CheckinController {

    private final CheckinService checkinService;

    public CheckinController(CheckinService checkinService) {
        this.checkinService = checkinService;
    }

    /** 今日签到。重复签到不报错，justChecked=false。 */
    @PostMapping("/checkin")
    public ApiResult<CheckinResponse> checkin() {
        return ApiResult.ok(checkinService.checkin());
    }

    /** 签到状态：今日是否已签 / 累计 / 连续 / 本月天数 + 已签日期列表。 */
    @GetMapping("/checkin")
    public ApiResult<CheckinResponse> status() {
        return ApiResult.ok(checkinService.status());
    }
}
