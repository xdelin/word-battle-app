package com.wordbattle.studyroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudyRoomApplicationRepository extends JpaRepository<StudyRoomApplication, UUID> {

    List<StudyRoomApplication> findByRoomIdAndStatus(UUID roomId, String status);

    Optional<StudyRoomApplication> findByRoomIdAndUserIdAndStatus(UUID roomId, UUID userId, String status);

    /** 待审申请（join users 拿 name/avatarUrl），按申请时间升序。 */
    @Query(value = """
            select a.id as "id", a.user_id as "userId", u.name as "userName",
                   u.avatar_url as "avatarUrl", a.created_at as "createdAt"
            from study_room_applications a
            inner join users u on u.id = a.user_id
            where a.room_id = cast(:roomId as uuid) and a.status = 'pending'
            order by a.created_at asc
            """, nativeQuery = true)
    List<StudyRoomApplicationProjection> findPendingWithUser(@Param("roomId") String roomId);
}
