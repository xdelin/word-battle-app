package com.wordbattle.lesson;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeOptionRepository extends JpaRepository<ChallengeOption, Integer> {

    /** 批量取多个 challenge 的选项，按 order 升序。 */
    List<ChallengeOption> findByChallengeIdInOrderByOrderAsc(List<Integer> challengeIds);
}
