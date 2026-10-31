package com.wordbattle.lesson;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CardRepository extends JpaRepository<Card, UUID> {

    /** 按 word 批量查（同一 word 可能属于多本词书，取首条）。 */
    List<Card> findByWordIn(List<String> words);

    /** 按 word 查首条（加入复习/熟记用）。 */
    Optional<Card> findFirstByWord(String word);
}
