package com.wordbattle.pk;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PkUserAnswerRepository extends JpaRepository<PkUserAnswer, UUID> {

    /** 某用户在某题的答案（幂等检查）。 */
    Optional<PkUserAnswer> findByUserIdAndQuestionId(UUID userId, UUID questionId);

    /** 房间所有答案（轮询用），按 answeredAt 升序。 */
    List<PkUserAnswer> findByRoomIdOrderByAnsweredAtAsc(UUID roomId);
}
