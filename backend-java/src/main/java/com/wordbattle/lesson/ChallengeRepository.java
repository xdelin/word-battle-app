package com.wordbattle.lesson;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Integer> {

    List<Challenge> findByLessonIdOrderByOrderAsc(Integer lessonId);
}
