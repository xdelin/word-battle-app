package com.wordbattle.studyroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface StudyRoomReminderRepository extends JpaRepository<StudyRoomReminder, UUID> {

    /** 我的未读提醒（join users 拿发起人信息），按时间倒序。 */
    @Query(value = """
            select r.id as "id", r.from_user_id as "fromUserId", u.name as "fromUserName",
                   u.avatar_url as "fromUserAvatar", r.message as "message", r.created_at as "createdAt"
            from study_room_reminders r
            inner join users u on u.id = r.from_user_id
            where r.room_id = cast(:roomId as uuid)
              and r.to_user_id = cast(:toUserId as uuid)
              and r.read_at is null
            order by r.created_at desc
            """, nativeQuery = true)
    List<StudyRoomReminderProjection> findUnreadWithUser(@Param("roomId") String roomId,
                                                        @Param("toUserId") String toUserId);
}
