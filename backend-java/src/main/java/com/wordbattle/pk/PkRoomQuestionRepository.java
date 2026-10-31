package com.wordbattle.pk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PkRoomQuestionRepository extends JpaRepository<PkRoomQuestion, UUID> {

    /** 按 roomId 取题目，按 questionIndex 升序。 */
    List<PkRoomQuestion> findByRoomIdOrderByQuestionIndexAsc(UUID roomId);

    /**
     * 随机取候选词（card + translation + definitions + ipa + confusable），用于生成题目。poolSize 为取数。
     * 返回 Object[]：[0]=cardId(UUID), [1]=word(String), [2]=translation(String),
     * [3]=confusable(jsonb String), [4]=definitions(jsonb String), [5]=ipa(String)。
     * definitions/ipa 用于配选项英文释义与题干音标。
     * 用 Object[] 而非接口投影，避免 Hibernate 别名映射的不确定性。
     */
    @Query(value = """
            select c.id, c.word, d.translation, d.confusable::text, d.definitions::text, d.ipa
            from cards c
            left join dictionary d on d.word = c.word
            where (:bookId is null or c.book_id = :bookId)
            order by random()
            limit :poolSize
            """, nativeQuery = true)
    List<Object[]> findCandidates(@Param("bookId") Integer bookId,
                                  @Param("poolSize") int poolSize);
}
