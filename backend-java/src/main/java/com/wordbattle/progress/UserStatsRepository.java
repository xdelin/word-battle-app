package com.wordbattle.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface UserStatsRepository extends JpaRepository<UserStats, UUID> {

    /** 关卡完成时累加经验与掌握词数。 */
    @Modifying
    @Query(value = """
            update user_stats
            set total_xp = total_xp + :xp,
                words_learned = words_learned + 1,
                updated_at = now()
            where user_id = cast(:userId as uuid)
            """, nativeQuery = true)
    void addXpAndWord(@Param("userId") String userId, @Param("xp") int xp);
}
