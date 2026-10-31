package com.wordbattle.pk;

import com.wordbattle.common.ApiResult;
import com.wordbattle.pk.dto.CreateRoomRequest;
import com.wordbattle.pk.dto.JoinRoomRequest;
import com.wordbattle.pk.dto.LeaderboardEntryDto;
import com.wordbattle.pk.dto.NpcSubmitResponse;
import com.wordbattle.pk.dto.PkQuestionDto;
import com.wordbattle.pk.dto.PkRoomAnswerDto;
import com.wordbattle.pk.dto.PkRoomDetailDto;
import com.wordbattle.pk.dto.PkRoomDto;
import com.wordbattle.pk.dto.SideResult;
import com.wordbattle.pk.dto.StartNpcRequest;
import com.wordbattle.pk.dto.SubmitAnswerRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pk")
public class PkController {

    private final PkService pkService;
    private final LeaderboardService leaderboardService;

    public PkController(PkService pkService, LeaderboardService leaderboardService) {
        this.pkService = pkService;
        this.leaderboardService = leaderboardService;
    }

    /** 词力值排行榜 Top N（Redis ZSET）。 */
    @GetMapping("/leaderboard")
    public ApiResult<List<LeaderboardEntryDto>> leaderboard(@RequestParam(defaultValue = "10") int limit) {
        return ApiResult.ok(leaderboardService.top(limit));
    }

    /** 创建好友/随机房间。 */
    @PostMapping("/rooms")
    public ApiResult<PkRoomDto> createRoom(@Valid @RequestBody CreateRoomRequest req) {
        return ApiResult.ok(pkService.createRoom(req));
    }

    /** 加入房间。 */
    @PostMapping("/rooms/join")
    public ApiResult<PkRoomDto> joinRoom(@Valid @RequestBody JoinRoomRequest req) {
        return ApiResult.ok(pkService.joinRoom(req));
    }

    /** 房主开始对战，返回题目。 */
    @PostMapping("/rooms/start")
    public ApiResult<List<PkQuestionDto>> startGame(@RequestBody StartGameRequestWrapper req) {
        return ApiResult.ok(pkService.startGame(req.userId(), req.roomId()));
    }

    /** 提交答案（真人对战）。 */
    @PostMapping("/answers")
    public ApiResult<SideResult> submitAnswer(@Valid @RequestBody SubmitAnswerRequest req) {
        return ApiResult.ok(pkService.submitAnswer(req));
    }

    /** NPC 对战开局：建房 + 题目 + NPC 对手，直接进 playing。 */
    @PostMapping("/npc/start")
    public ApiResult<com.wordbattle.pk.dto.StartNpcResponse> startNpc(@RequestBody StartNpcRequest req) {
        return ApiResult.ok(pkService.startNpcGame(req));
    }

    /** NPC 对战提交答案（含 NPC 模拟答题）。 */
    @PostMapping("/npc/answer")
    public ApiResult<NpcSubmitResponse> submitNpc(@Valid @RequestBody SubmitAnswerRequest req) {
        return ApiResult.ok(pkService.submitNpcAnswer(req));
    }

    /** 结束游戏（结算 Elo + 房间 finished）。 */
    @PostMapping("/rooms/{roomId}/end")
    public ApiResult<Void> endGame(@PathVariable String roomId) {
        pkService.endGame(roomId);
        return ApiResult.ok();
    }

    /** 房间详情（含玩家 + 题目）。 */
    @GetMapping("/rooms/{roomId}")
    public ApiResult<PkRoomDetailDto> getRoom(@PathVariable String roomId) {
        return ApiResult.ok(pkService.getRoom(roomId));
    }

    /** 房间答题记录（轮询双方进度）。 */
    @GetMapping("/rooms/{roomId}/answers")
    public ApiResult<List<PkRoomAnswerDto>> getRoomAnswers(@PathVariable String roomId) {
        return ApiResult.ok(pkService.getRoomAnswers(roomId));
    }

    /** startGame 请求体（userId + roomId）。 */
    public record StartGameRequestWrapper(String userId, String roomId) {
    }
}
