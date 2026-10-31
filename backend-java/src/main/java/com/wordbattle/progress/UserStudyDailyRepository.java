package com.wordbattle.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface UserStudyDailyRepository extends JpaRepository<UserStudyDaily, UUID> {

    Optional<UserStudyDaily> findByUserIdAndDate(UUID userId, LocalDate date);

    /** upsert：当日 newWords/reviewWords 累加（ON CONFLICT 更新）。 */
    @Modifying
    @Query(value = """
            INSERT INTO user_study_daily (id, user_id, date, new_words, review_words)
            VALUES (gen_random_uuid(), cast(:userId as uuid), :date, :newDelta, :reviewDelta)
            ON CONFLICT (user_id, date) DO UPDATE
            SET new_words = user_study_daily.new_words + EXCLUDED.new_words,
                review_words = user_study_daily.review_words + EXCLUDED.review_words
            """, nativeQuery = true)
    void upsertDaily(@Param("userId") String userId,
                     @Param("date") LocalDate date,
                     @Param("newDelta") int newDelta,
                     @Param("reviewDelta") int reviewDelta);
}
