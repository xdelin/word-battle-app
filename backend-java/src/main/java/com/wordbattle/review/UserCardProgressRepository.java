package com.wordbattle.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserCardProgressRepository extends JpaRepository<UserCardProgress, UUID> {

    /**
     * 到期的复习卡（已存在进度且 due <= now），排除隐藏词库。按 due 升序，限 N。
     * 投影别名与 findNewCards 完全一致（union 友好）。
     * 同一词可能分属多本词书（多个 card_id）导致多行进度，用 DISTINCT ON (c.word) 每词只取一张，
     * 避免复习队列里同词重复出题。
     */
    @Query(value = """
            select * from (
              select distinct on (c.word)
                     c.id as "cardId",
                     c.word as "word",
                     c.book_id as "bookId",
                     c.difficulty as "difficulty",
                     c.tags as "tags",
                     d.pos as "pos",
                     d.ipa as "ipa",
                     d.audio_url as "audioUrl",
                     d.definitions as "definitions",
                     d.examples as "examples",
                     d.forms as "forms",
                     d.etymology as "etymology",
                     d.synonyms as "synonyms",
                     d.antonyms as "antonyms",
                     d.related as "related",
                     d.translation as "translation",
                     d.frequency as "frequency",
                     d.discrimination as "discrimination",
                     d.collocations as "collocations",
                     d.confusable as "confusable",
                     ucp.fsrs_due_date as "fsrsDueDate",
                     ucp.total_reviews as "totalReviews",
                     ucp.total_correct as "totalCorrect"
              from user_card_progress ucp
              inner join cards c on c.id = ucp.card_id
              left join dictionary d on d.word = c.word
              where ucp.user_id = cast(:userId as uuid)
                and ucp.fsrs_due_date <= :now
                and coalesce(c.book_id, 0) <> coalesce(:hiddenBookId, -1)
              order by c.word, ucp.fsrs_due_date asc
            ) t
            order by t."fsrsDueDate" asc
            limit :limit
            """, nativeQuery = true)
    List<ReviewCardProjection> findDueCards(@Param("userId") String userId,
                                            @Param("now") Instant now,
                                            @Param("hiddenBookId") Integer hiddenBookId,
                                            @Param("limit") int limit);

    /**
     * 全新卡（用户无进度），按 difficulty 升序，排除隐藏词库。
     * ucp 相关列返回 null（接口投影类型可空）。
     * 同一词可能分属多本词书（多个 card_id），用 DISTINCT ON (c.word) 每词只取一张，
     * 避免复习队列里同词重复出题。
     */
    @Query(value = """
            select * from (
              select distinct on (c.word)
                     c.id as "cardId",
                     c.word as "word",
                     c.book_id as "bookId",
                     c.difficulty as "difficulty",
                     c.tags as "tags",
                     d.pos as "pos",
                     d.ipa as "ipa",
                     d.audio_url as "audioUrl",
                     d.definitions as "definitions",
                     d.examples as "examples",
                     d.forms as "forms",
                     d.etymology as "etymology",
                     d.synonyms as "synonyms",
                     d.antonyms as "antonyms",
                     d.related as "related",
                     d.translation as "translation",
                     d.frequency as "frequency",
                     d.discrimination as "discrimination",
                     d.collocations as "collocations",
                     d.confusable as "confusable",
                     null as "fsrsDueDate",
                     null as "totalReviews",
                     null as "totalCorrect"
              from cards c
              left join dictionary d on d.word = c.word
              left join user_card_progress ucp on ucp.card_id = c.id and ucp.user_id = cast(:userId as uuid)
              where ucp.id is null
                and coalesce(c.book_id, 0) <> coalesce(:hiddenBookId, -1)
                and c.word not in (
                  select c2.word from user_card_progress ucp2
                  join cards c2 on c2.id = ucp2.card_id
                  where ucp2.user_id = cast(:userId as uuid)
                )
              order by c.word, c.difficulty asc
            ) t
            order by t."difficulty" asc
            limit :limit
            """, nativeQuery = true)
    List<ReviewCardProjection> findNewCards(@Param("userId") String userId,
                                           @Param("hiddenBookId") Integer hiddenBookId,
                                           @Param("limit") int limit);

    /**
     * 按给定词批量查 cards + dictionary 富字段（用于结算页词卡预取）。
     * 同一词可能分属多本词书，DISTINCT ON (c.word) 每词只取一张。
     * 进度列返回 null（仅用于复用 toCardDto 投影，结算页只取字典富字段）。
     */
    @Query(value = """
            select * from (
              select distinct on (c.word)
                     c.id as "cardId",
                     c.word as "word",
                     c.book_id as "bookId",
                     c.difficulty as "difficulty",
                     c.tags as "tags",
                     d.pos as "pos",
                     d.ipa as "ipa",
                     d.audio_url as "audioUrl",
                     d.definitions as "definitions",
                     d.examples as "examples",
                     d.forms as "forms",
                     d.etymology as "etymology",
                     d.synonyms as "synonyms",
                     d.antonyms as "antonyms",
                     d.related as "related",
                     d.translation as "translation",
                     d.frequency as "frequency",
                     d.discrimination as "discrimination",
                     d.collocations as "collocations",
                     d.confusable as "confusable",
                     null as "fsrsDueDate",
                     null as "totalReviews",
                     null as "totalCorrect"
              from cards c
              left join dictionary d on d.word = c.word
              where c.word in (:words)
              order by c.word, c.difficulty asc
            ) t
            order by t."word"
            """, nativeQuery = true)
    List<ReviewCardProjection> findCardsByWords(@Param("words") List<String> words);

    /** 单卡进度（评分提交用）。 */
    Optional<UserCardProgress> findByUserIdAndCardId(UUID userId, UUID cardId);

    /**
     * 按 (userId, word) 查首条复习进度。
     * 同一词可能分属多本词书（cards 表多行、多个 card_id）。加入复习按「词」去重：
     * 复用该用户对任意 card 的已有进度，而不是按 findFirstByWord 选中的某个 card，
     * 避免同一词因 card 不同而重复建进度、复习队列里同词重复出题。
     */
    @Query(value = """
            select ucp.* from user_card_progress ucp
            join cards c on c.id = ucp.card_id
            where ucp.user_id = cast(:userId as uuid) and c.word = :word
            limit 1
            """, nativeQuery = true)
    Optional<UserCardProgress> findFirstByUserIdAndWord(@Param("userId") String userId,
                                                       @Param("word") String word);

    /**
     * 删除该用户对某词的全部复习进度（同一词可能跨多本词书存在多条 card 进度）。
     * 熟记时按词清空，确保任何 card 上的进度都能被移除，而不只删 findFirstByWord 选中的那一张。
     */
    @Modifying
    @Query(value = """
            delete from user_card_progress
            where user_id = cast(:userId as uuid)
              and card_id in (select id from cards where word = :word)
            """, nativeQuery = true)
    int deleteByUserIdAndWord(@Param("userId") String userId, @Param("word") String word);

    /**
     * 该用户已在复习计划中的词（与给定词表取交集，按词去重）。
     * 用于结算页预显"已加入"：按词查进度（任意 card 有进度即算在计划中）。
     */
    @Query(value = """
            select distinct c.word from user_card_progress ucp
            join cards c on c.id = ucp.card_id
            where ucp.user_id = cast(:userId as uuid) and c.word in (:words)
            """, nativeQuery = true)
    List<String> findWordsInPlan(@Param("userId") String userId, @Param("words") List<String> words);
}
