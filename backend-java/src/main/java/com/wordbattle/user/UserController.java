package com.wordbattle.user;

import com.wordbattle.common.ApiResult;
import com.wordbattle.user.dto.DailyGoalRequest;
import com.wordbattle.user.dto.UserSettingsResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** 当前用户设置（含每日目标关卡数）。 */
    @GetMapping("/me/settings")
    public ApiResult<UserSettingsResponse> getSettings() {
        return ApiResult.ok(userService.getSettings());
    }

    /** 今日已完成关卡数。 */
    @GetMapping("/me/today-lessons")
    public ApiResult<Map<String, Long>> getTodayLessons() {
        return ApiResult.ok(Map.of("completedToday", userService.countTodayCompletedLessons()));
    }

    /** 更新每日目标关卡数（1~50）。 */
    @PutMapping("/me/settings/daily-goal")
    public ApiResult<UserSettingsResponse> updateDailyGoal(@Valid @RequestBody DailyGoalRequest req) {
        if (req.dailyGoalLessons() == null) {
            throw new IllegalArgumentException("dailyGoalLessons 不能为空");
        }
        return ApiResult.ok(userService.updateDailyGoalLessons(req.dailyGoalLessons()));
    }

    /** 兼容路径：按 userId 查设置（暂等同于 me，后续接 JWT 后此路径可移除）。 */
    @GetMapping("/{userId}/settings")
    public ApiResult<UserSettingsResponse> getSettingsByUserId(@PathVariable String userId) {
        return ApiResult.ok(userService.getSettings());
    }
}
