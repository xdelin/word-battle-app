package com.wordbattle.enrich;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Enrich 查询：查某词书里待 enrich 的词（collocations/examples/discrimination 任一为 NULL）。
 * 写回用原生 SQL（examples/collocations 为 jsonb，需 cast）。
 */
@Repository
@Transactional(readOnly = true)
public class EnrichRepository {

    private final EntityManager em;

    public EnrichRepository(EntityManager em) {
        this.em = em;
    }

    /**
     * 查待 enrich 的词。
     * 返回 Object[]：[0]=word, [1]=pos, [2]=translation
     */
    @SuppressWarnings("unchecked")
    public List<Object[]> findWordsNeedingEnrichment(String bookShortName) {
        return em.createNativeQuery("""
                select d.word, d.pos, d.translation
                from dictionary d
                inner join cards c on c.word = d.word
                inner join books b on b.id = c.book_id
                where b.short_name = :bookShortName
                  and d.translation is not null
                  and (
                    d.collocations is null
                    or d.discrimination is null
                    or d.examples is null
                    -- examples 存在但无 translation 字段 = 被 import-kaikki 覆盖的纯英文例句，需重新 enrich 生成双语
                    or (d.examples is not null and not exists (
                      select 1 from jsonb_array_elements(d.examples) e where e ? 'translation'
                    ))
                  )
                order by d.word
                """)
                .setParameter("bookShortName", bookShortName)
                .getResultList();
    }

    /**
     * 写回 enrich 结果。
     * examples 存双层编码字符串（与 Drizzle 落库一致）："[{\"text\":...}]"
     * collocations 存双层编码字符串
     */
    @Transactional
    public void applyResult(String word, String examplesJson, String collocationsJson, String discrimination) {
        // examples/collocations 存双层编码字符串（与 TS Drizzle 落库一致）：
        //   to_jsonb(cast(:text as text)) 把 JSON 字符串整体当作一个 jsonb string 值存，
        //   即 jsonb_typeof = 'string'，原文形如 "[{\"text\":...}]"。
        //   注意：Hibernate 原生查询里 :name::text 会被误解析，用 cast(... as text) 规避。
        em.createNativeQuery("""
                update dictionary
                set examples = to_jsonb(cast(:examples as text)),
                    collocations = to_jsonb(cast(:collocations as text)),
                    discrimination = :discrimination,
                    updated_at = now()
                where word = :word
                """)
                .setParameter("examples", examplesJson)
                .setParameter("collocations", collocationsJson)
                .setParameter("discrimination", discrimination)
                .setParameter("word", word)
                .executeUpdate();
    }
}
