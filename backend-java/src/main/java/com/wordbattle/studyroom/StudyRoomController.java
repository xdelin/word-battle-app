package com.wordbattle.studyroom;

import com.wordbattle.common.ApiResult;
import com.wordbattle.studyroom.dto.CreateRoomRequest;
import com.wordbattle.studyroom.dto.JoinRoomRequest;
import com.wordbattle.studyroom.dto.ReminderDto;
import com.wordbattle.studyroom.dto.RoomDetailDto;
import com.wordbattle.studyroom.dto.StudyRoomApplicationDto;
import com.wordbattle.studyroom.dto.StudyRoomDto;
import com.wordbattle.studyroom.dto.UpdateRoomRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/study-rooms")
public class StudyRoomController {

    private final StudyRoomService studyRoomService;

    public StudyRoomController(StudyRoomService studyRoomService) {
        this.studyRoomService = studyRoomService;
    }

    /** 创建自习室。 */
    @PostMapping
    public ApiResult<StudyRoomDto> create(@RequestBody CreateRoomRequest req) {
        return ApiResult.ok(studyRoomService.createRoom(req));
    }

    /** 广场：公开自习室列表。 */
    @GetMapping("/plaza")
    public ApiResult<List<StudyRoomDto>> plaza() {
        return ApiResult.ok(studyRoomService.getPlaza());
    }

    /** 加入（按码）。 */
    @PostMapping("/join")
    public ApiResult<StudyRoomDto> join(@RequestBody JoinRoomRequest req) {
        return ApiResult.ok(studyRoomService.join(req.code()));
    }

    /** 我加入的自习室。 */
    @GetMapping("/mine")
    public ApiResult<List<StudyRoomDto>> mine() {
        return ApiResult.ok(studyRoomService.getMine());
    }

    /** 自习室详情（含成员列表）。 */
    @GetMapping("/{id}")
    public ApiResult<RoomDetailDto> detail(@PathVariable UUID id) {
        return ApiResult.ok(studyRoomService.getRoom(id));
    }

    /** 退出自习室。owner 退出则删除整个自习室。 */
    @DeleteMapping("/{id}/leave")
    public ApiResult<Void> leave(@PathVariable UUID id) {
        studyRoomService.leave(id);
        return ApiResult.ok();
    }

    /** 更新自习室设置（管理员）。 */
    @PatchMapping("/{id}")
    public ApiResult<StudyRoomDto> update(@PathVariable UUID id, @RequestBody UpdateRoomRequest req) {
        return ApiResult.ok(studyRoomService.updateRoom(id, req));
    }

    /** 待审申请列表（管理员）。 */
    @GetMapping("/{id}/applications")
    public ApiResult<List<StudyRoomApplicationDto>> applications(@PathVariable UUID id) {
        return ApiResult.ok(studyRoomService.getApplications(id));
    }

    /** 通过申请（管理员）。 */
    @PostMapping("/{id}/applications/{appId}/approve")
    public ApiResult<Void> approve(@PathVariable UUID id, @PathVariable UUID appId) {
        studyRoomService.approveApplication(id, appId);
        return ApiResult.ok();
    }

    /** 拒绝申请（管理员）。 */
    @PostMapping("/{id}/applications/{appId}/reject")
    public ApiResult<Void> reject(@PathVariable UUID id, @PathVariable UUID appId) {
        studyRoomService.rejectApplication(id, appId);
        return ApiResult.ok();
    }

    /** 提醒某成员打卡。 */
    @PostMapping("/{id}/members/{userId}/remind")
    public ApiResult<Void> remind(@PathVariable UUID id, @PathVariable UUID userId) {
        studyRoomService.remind(id, userId);
        return ApiResult.ok();
    }

    /** 管理员移除成员。 */
    @DeleteMapping("/{id}/members/{userId}")
    public ApiResult<Void> kickMember(@PathVariable UUID id, @PathVariable UUID userId) {
        studyRoomService.kickMember(id, userId);
        return ApiResult.ok();
    }

    /** 我的未读提醒列表。 */
    @GetMapping("/{id}/reminders")
    public ApiResult<List<ReminderDto>> reminders(@PathVariable UUID id) {
        return ApiResult.ok(studyRoomService.getMyReminders(id));
    }

    /** 标记提醒已读。 */
    @PostMapping("/reminders/{reminderId}/read")
    public ApiResult<Void> markReminderRead(@PathVariable UUID reminderId) {
        studyRoomService.markReminderRead(reminderId);
        return ApiResult.ok();
    }
}
