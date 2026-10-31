package com.wordbattle.wordsearch;

import com.wordbattle.wordsearch.dto.WordSearchWordDto;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 找词游戏取词。1:1 复刻 getWordsForWordSearch：
 *   - 从 cards join dictionary 取 word + translation
 *   - 过滤：长度 3-7、纯字母、有中文释义、去重（小写）
 *   - 打乱后取 limit 个
 *   - translation 截短：replace \n -> 空格，split 第一个 ;；
 *
 * 用 EntityManager 原生 SQL + 内存过滤（与 TS 端一致，避免复杂 SQL）。
 */
@Repository
@Transactional(readOnly = true)
public class WordSearchRepository {

    private final EntityManager em;

    public WordSearchRepository(EntityManager em) {
        this.em = em;
    }

    /**
     * 取某词书的候选词（全部，内存过滤后打乱取 limit）。
     * 返回 Object[]：[0]=word, [1]=translation。
     */
    @SuppressWarnings("unchecked")
    public List<Object[]> findCandidates(Integer bookId) {
        return em.createNativeQuery("""
                select c.word, d.translation
                from cards c
                left join dictionary d on d.word = c.word
                where c.book_id = :bookId
                """)
                .setParameter("bookId", bookId)
                .getResultList();
    }

    /** 过滤 + 打乱 + 取 limit。 */
    public List<WordSearchWordDto> pickWords(Integer bookId, int limit) {
        List<Object[]> rows = findCandidates(bookId);
        Set<String> seen = new HashSet<>();
        List<WordSearchWordDto> filtered = new ArrayList<>();
        for (Object[] r : rows) {
            String word = r[0] == null ? null : r[0].toString().trim();
            String translation = r[1] == null ? null : r[1].toString();
            if (word == null || word.isEmpty() || translation == null || translation.isEmpty()) continue;
            if (word.length() < 3 || word.length() > 7) continue;
            if (!word.matches("^[a-zA-Z]+$")) continue;
            if (seen.contains(word.toLowerCase())) continue;
            seen.add(word.toLowerCase());
            // translation 截短：\\n -> 空格，split 第一个 ;；
            String shortTrans = translation.replace("\\n", " ").split("[;；]")[0].trim();
            filtered.add(new WordSearchWordDto(word, shortTrans));
        }
        Collections.shuffle(filtered);
        return filtered.subList(0, Math.min(limit, filtered.size()));
    }
}
