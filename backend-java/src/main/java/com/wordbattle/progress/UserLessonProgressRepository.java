package com.wordbattle.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserLessonProgressRepository extends JpaRepository<UserLessonProgress, Integer> {

    Optional<UserLessonProgress> findByUserIdAndLessonId(UUID userId, Integer lessonId);
}
