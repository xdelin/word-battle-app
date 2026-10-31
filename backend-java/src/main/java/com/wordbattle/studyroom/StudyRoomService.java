package com.wordbattle.studyroom;

import com.wordbattle.studyroom.dto.CreateRoomRequest;
import com.wordbattle.studyroom.dto.ReminderDto;
import com.wordbattle.studyroom.dto.RoomDetailDto;
import com.wordbattle.studyroom.dto.StudyRoomApplicationDto;
import com.wordbattle.studyroom.dto.StudyRoomDto;
import com.wordbattle.studyroom.dto.StudyRoomMemberDto;
import com.wordbattle.studyroom.dto.UpdateRoomRequest;
import com.wordbattle.user.CurrentUserResolver;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * 自习室服务：创建 / 广场 / 加入（码/申请）/ 我的 / 详情。
 * userId 解析与 pk/review 一致（CurrentUserResolver）。
 */
@Service
@Transactional
public class StudyRoomService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混 I O 0 1

    private final StudyRoomRepository roomRepository;
    private final StudyRoomMemberRepository memberRepository;
    private final StudyRoomApplicationRepository applicationRepository;
    private final StudyRoomReminderRepository reminderRepository;
    private final CurrentUserResolver currentUser;

    public StudyRoomService(StudyRoomRepository roomRepository,
                            StudyRoomMemberRepository memberRepository,
                            StudyRoomApplicationRepository applicationRepository,
                            StudyRoomReminderRepository reminderRepository,
                            CurrentUserResolver currentUser) {
        this.roomRepository = roomRepository;
        this.memberRepository = memberRepository;
        this.applicationRepository = applicationRepository;
        this.reminderRepository = reminderRepository;
        this.currentUser = currentUser;
    }

    private UUID userId() {
        return UUID.fromString(currentUser.getUserId());
    }

    /** 创建自习室；创建者自动成为 admin 成员。 */
    public StudyRoomDto createRoom(CreateRoomRequest req) {
        UUID uid = userId();
        if (!memberRepository.findByUserId(uid).isEmpty()) {
            throw new IllegalArgumentException("已加入自习室，请先退出后再创建");
        }
        StudyRoom room = new StudyRoom();
        room.setId(UUID.randomUUID());
        room.setName(req.name() == null || req.name().isBlank() ? "我的自习室" : req.name().trim());
        room.setCode(generateUniqueCode());
        room.setOwnerId(uid);
        room.setIsPublic(req.isPublic() == null ? Boolean.TRUE : req.isPublic());
        room.setRequireApproval(req.requireApproval() == null ? Boolean.FALSE : req.requireApproval());
        room.setDailyGoal(req.dailyGoal() == null || req.dailyGoal() <= 0 ? 20 : req.dailyGoal());
        Instant now = Instant.now();
        room.setCreatedAt(now);
        room.setUpdatedAt(now);
        roomRepository.save(room);

        StudyRoomMember m = new StudyRoomMember();
        m.setId(UUID.randomUUID());
        m.setRoomId(room.getId());
        m.setUserId(uid);
        m.setIsAdmin(true);
        m.setJoinedAt(now);
        memberRepository.save(m);
        return toDto(room);
    }

    /** 广场：公开自习室列表。 */
    public List<StudyRoomDto> getPlaza() {
        return roomRepository.findByIsPublicTrueOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    /** 加入（按码）：requireApproval=false 直接加成员；true 创建待审申请。 */
    public StudyRoomDto join(String code) {
        UUID uid = userId();
        StudyRoom room = roomRepository.findByCode(code == null ? "" : code.trim().toUpperCase())
                .orElseThrow(() -> new EntityNotFoundException("自习室不存在或加入码错误"));
        // 已是成员直接返回
        if (memberRepository.findByRoomIdAndUserId(room.getId(), uid).isPresent()) {
            return toDto(room);
        }
        // 每个用户只能加入一个自习室
        if (!memberRepository.findByUserId(uid).isEmpty()) {
            throw new IllegalArgumentException("已加入其他自习室，请先退出后再加入");
        }
        if (Boolean.TRUE.equals(room.getRequireApproval())) {
            if (applicationRepository.findByRoomIdAndUserIdAndStatus(room.getId(), uid, "pending").isPresent()) {
                throw new IllegalStateException("已申请，等待管理员审核");
            }
            StudyRoomApplication app = new StudyRoomApplication();
            app.setId(UUID.randomUUID());
            app.setRoomId(room.getId());
            app.setUserId(uid);
            app.setStatus("pending");
            app.setCreatedAt(Instant.now());
            applicationRepository.save(app);
            return toDto(room);
        }
        StudyRoomMember m = new StudyRoomMember();
        m.setId(UUID.randomUUID());
        m.setRoomId(room.getId());
        m.setUserId(uid);
        m.setIsAdmin(false);
        m.setJoinedAt(Instant.now());
        memberRepository.save(m);
        return toDto(room);
    }

    /** 我加入的自习室。 */
    public List<StudyRoomDto> getMine() {
        UUID uid = userId();
        return memberRepository.findByUserId(uid).stream()
                .map(m -> roomRepository.findById(m.getRoomId()).orElse(null))
                .filter(Objects::nonNull)
                .map(this::toDto)
                .toList();
    }

    /** 自习室详情（含成员列表）。 */
    public RoomDetailDto getRoom(UUID roomId) {
        StudyRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new EntityNotFoundException("自习室不存在"));
        List<StudyRoomMemberDto> members = memberRepository.findMembersWithUser(roomId.toString()).stream()
                .map(p -> new StudyRoomMemberDto(
                        p.getUserId().toString(),
                        p.getName(),
                        p.getAvatarUrl(),
                        p.getIsAdmin(),
                        p.getJoinedAt(),
                        p.getTodayNewWords(),
                        p.getTodayReviewWords(),
                        p.getStreakDays(),
                        p.getTotalStudyDays()))
                .toList();
        boolean isAdmin = memberRepository.findByRoomIdAndUserId(roomId, userId())
                .map(StudyRoomMember::getIsAdmin).orElse(false);
        return new RoomDetailDto(toDto(room), members, isAdmin, currentUser.getUserId());
    }

    /** 退出自习室。owner 退出则删除整个自习室（cascade 清成员/申请）。 */
    public void leave(UUID roomId) {
        UUID uid = userId();
        StudyRoomMember m = memberRepository.findByRoomIdAndUserId(roomId, uid)
                .orElseThrow(() -> new EntityNotFoundException("你不在该自习室"));
        StudyRoom room = roomRepository.findById(roomId).orElse(null);
        boolean isOwner = room != null && room.getOwnerId().equals(uid);
        memberRepository.delete(m);
        memberRepository.flush();
        if (isOwner) {
            roomRepository.deleteById(roomId); // DB cascade 清 members/applications
        }
    }

    /** 管理员更新自习室设置。 */
    public StudyRoomDto updateRoom(UUID roomId, UpdateRoomRequest req) {
        assertAdmin(roomId);
        StudyRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new EntityNotFoundException("自习室不存在"));
        if (req.name() != null && !req.name().isBlank()) room.setName(req.name().trim());
        if (req.isPublic() != null) room.setIsPublic(req.isPublic());
        if (req.requireApproval() != null) room.setRequireApproval(req.requireApproval());
        if (req.dailyGoal() != null && req.dailyGoal() > 0) room.setDailyGoal(req.dailyGoal());
        room.setUpdatedAt(Instant.now());
        roomRepository.save(room);
        return toDto(room);
    }

    /** 待审申请列表（管理员）。 */
    public List<StudyRoomApplicationDto> getApplications(UUID roomId) {
        assertAdmin(roomId);
        return applicationRepository.findPendingWithUser(roomId.toString()).stream()
                .map(p -> new StudyRoomApplicationDto(
                        p.getId().toString(), p.getUserId().toString(),
                        p.getUserName(), p.getAvatarUrl(), "pending", p.getCreatedAt()))
                .toList();
    }

    /** 通过申请（管理员）：置 approved + 加成员。 */
    public void approveApplication(UUID roomId, UUID appId) {
        assertAdmin(roomId);
        StudyRoomApplication app = applicationRepository.findById(appId)
                .orElseThrow(() -> new EntityNotFoundException("申请不存在"));
        if (!app.getRoomId().equals(roomId)) {
            throw new IllegalArgumentException("申请不属于该自习室");
        }
        app.setStatus("approved");
        applicationRepository.save(app);
        if (memberRepository.findByRoomIdAndUserId(roomId, app.getUserId()).isEmpty()) {
            StudyRoomMember nm = new StudyRoomMember();
            nm.setId(UUID.randomUUID());
            nm.setRoomId(roomId);
            nm.setUserId(app.getUserId());
            nm.setIsAdmin(false);
            nm.setJoinedAt(Instant.now());
            memberRepository.save(nm);
        }
    }

    /** 拒绝申请（管理员）：置 rejected。 */
    public void rejectApplication(UUID roomId, UUID appId) {
        assertAdmin(roomId);
        StudyRoomApplication app = applicationRepository.findById(appId)
                .orElseThrow(() -> new EntityNotFoundException("申请不存在"));
        if (!app.getRoomId().equals(roomId)) {
            throw new IllegalArgumentException("申请不属于该自习室");
        }
        app.setStatus("rejected");
        applicationRepository.save(app);
    }

    /** 校验当前用户是该自习室管理员。 */
    private void assertAdmin(UUID roomId) {
        UUID uid = userId();
        StudyRoomMember m = memberRepository.findByRoomIdAndUserId(roomId, uid)
                .orElseThrow(() -> new EntityNotFoundException("不在该自习室"));
        if (!Boolean.TRUE.equals(m.getIsAdmin())) {
            throw new IllegalArgumentException("仅管理员可操作");
        }
    }

    /** 管理员移除成员。不能移除自己/室主。 */
    public void kickMember(UUID roomId, UUID userId) {
        assertAdmin(roomId);
        UUID uid = userId();
        if (userId.equals(uid)) {
            throw new IllegalArgumentException("不能移除自己，请用退出");
        }
        StudyRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new EntityNotFoundException("自习室不存在"));
        if (room.getOwnerId().equals(userId)) {
            throw new IllegalArgumentException("不能移除室主");
        }
        StudyRoomMember m = memberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new EntityNotFoundException("该用户不在自习室"));
        memberRepository.delete(m);
    }

    /** 提醒某成员打卡。fromUser 必须是本自习室成员，不能提醒自己。 */
    public void remind(UUID roomId, UUID toUserId) {
        UUID uid = userId();
        memberRepository.findByRoomIdAndUserId(roomId, uid)
                .orElseThrow(() -> new EntityNotFoundException("你不在该自习室"));
        if (uid.equals(toUserId)) {
            throw new IllegalArgumentException("不能提醒自己");
        }
        StudyRoomReminder r = new StudyRoomReminder();
        r.setId(UUID.randomUUID());
        r.setRoomId(roomId);
        r.setFromUserId(uid);
        r.setToUserId(toUserId);
        r.setMessage("该打卡背单词啦！💪");
        r.setCreatedAt(Instant.now());
        reminderRepository.save(r);
    }

    /** 我的未读提醒列表。 */
    public List<ReminderDto> getMyReminders(UUID roomId) {
        UUID uid = userId();
        return reminderRepository.findUnreadWithUser(roomId.toString(), uid.toString()).stream()
                .map(p -> new ReminderDto(
                        p.getId().toString(),
                        p.getFromUserId().toString(),
                        p.getFromUserName(),
                        p.getFromUserAvatar(),
                        p.getMessage(),
                        p.getCreatedAt()))
                .toList();
    }

    /** 标记提醒已读（仅接收人可操作）。 */
    public void markReminderRead(UUID reminderId) {
        UUID uid = userId();
        StudyRoomReminder r = reminderRepository.findById(reminderId)
                .orElseThrow(() -> new EntityNotFoundException("提醒不存在"));
        if (!r.getToUserId().equals(uid)) {
            throw new IllegalArgumentException("无权操作该提醒");
        }
        r.setReadAt(Instant.now());
        reminderRepository.save(r);
    }

    private StudyRoomDto toDto(StudyRoom r) {
        int count = (int) memberRepository.countByRoomId(r.getId());
        return new StudyRoomDto(
                r.getId().toString(),
                r.getName(),
                r.getCode(),
                r.getOwnerId().toString(),
                r.getIsPublic(),
                r.getRequireApproval(),
                r.getDailyGoal(),
                count,
                r.getCreatedAt());
    }

    private String generateUniqueCode() {
        for (int i = 0; i < 5; i++) {
            String code = randomCode(6);
            if (roomRepository.findByCode(code).isEmpty()) return code;
        }
        return randomCode(6);
    }

    private String randomCode(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(CODE_CHARS.charAt((int) (Math.random() * CODE_CHARS.length())));
        }
        return sb.toString();
    }
}
