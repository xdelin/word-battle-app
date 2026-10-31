package com.wordbattle.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserChallengeProgressRepository extends JpaRepository<UserChallengeProgress, Integer> {

    Optional<UserChallengeProgress> findByUserIdAndChallengeId(UUID userId, Integer challengeId);

    /** 答错扣 1 心（不低于 0）。 */
    @Modifying
    @Query(value = """
            update user_stats
            set current_hearts = greatest(0, current_hearts - 1), updated_at = now()
            where user_id = cast(:userId as uuid)
            """, nativeQuery = true)
    void reduceHearts(@Param("userId") String userId);
}
