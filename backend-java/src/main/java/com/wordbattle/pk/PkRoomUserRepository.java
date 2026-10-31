package com.wordbattle.pk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PkRoomUserRepository extends JpaRepository<PkRoomUser, UUID> {

    List<PkRoomUser> findByRoomId(UUID roomId);

    Optional<PkRoomUser> findByRoomIdAndUserId(UUID roomId, UUID userId);

    /** 累加用户在房间中的分数/正确数/题号。 */
    @Modifying
    @Query(value = """
            update pk_room_users
            set total_score = total_score + :score,
                correct_count = correct_count + :correctDelta,
                question_index = question_index + 1
            where room_id = cast(:roomId as uuid) and user_id = cast(:userId as uuid)
            """, nativeQuery = true)
    void addScore(@Param("roomId") String roomId,
                  @Param("userId") String userId,
                  @Param("score") int score,
                  @Param("correctDelta") int correctDelta);

    /** 标记断开。 */
    @Modifying
    @Query(value = """
            update pk_room_users set disconnected_at = :ts
            where room_id = cast(:roomId as uuid) and user_id = cast(:userId as uuid)
            """, nativeQuery = true)
    void markDisconnected(@Param("roomId") String roomId, @Param("userId") String userId, @Param("ts") Instant ts);
}
