package com.wordbattle.studyroom;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudyRoomMemberRepository extends JpaRepository<StudyRoomMember, UUID> {

    List<StudyRoomMember> findByRoomId(UUID roomId);

    Optional<StudyRoomMember> findByRoomIdAndUserId(UUID roomId, UUID userId);

    List<StudyRoomMember> findByUserId(UUID userId);

    long countByRoomId(UUID roomId);

    void deleteByRoomIdAndUserId(UUID roomId, UUID userId);

    /** 成员列表（join users 拿 name/avatarUrl + 今日统计 + streak/总天数），按加入时间升序。 */
    @Query(value = """
            select m.user_id as "userId", u.name as "name", u.avatar_url as "avatarUrl",
                   m.is_admin as "isAdmin", m.joined_at as "joinedAt",
                   coalesce(d.new_words, 0) as "todayNewWords",
                   coalesce(d.review_words, 0) as "todayReviewWords",
                   coalesce(s.streak_days, 0) as "streakDays",
                   coalesce(s.total_study_days, 0) as "totalStudyDays"
            from study_room_members m
            inner join users u on u.id = m.user_id
            left join user_study_daily d on d.user_id = m.user_id and d.date = CURRENT_DATE
            left join user_stats s on s.user_id = m.user_id
            where m.room_id = cast(:roomId as uuid)
            order by m.joined_at asc
            """, nativeQuery = true)
    List<StudyRoomMemberProjection> findMembersWithUser(@Param("roomId") String roomId);
}
