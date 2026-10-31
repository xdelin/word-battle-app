package com.wordbattle.lesson;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface DictionaryRepository extends JpaRepository<Dictionary, String> {

    List<Dictionary> findByWordIn(List<String> words);

    /** 随机取一条有 definitions（英文释义）的 dictionary，用于混淆词缺英文释义时的兜底。 */
    @Query(value = """
            SELECT * FROM dictionary
            WHERE definitions IS NOT NULL AND definitions::text <> '[]'
            ORDER BY random() LIMIT 1
            """, nativeQuery = true)
    Optional<Dictionary> findRandomWithDefinitions();
}
