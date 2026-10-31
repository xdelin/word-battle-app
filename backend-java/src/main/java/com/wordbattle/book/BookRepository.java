package com.wordbattle.book;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BookRepository extends JpaRepository<Book, Integer> {

    /**
     * 查询非隐藏词书，按 id 升序。
     * 隐藏词书 short_name 见 HIDDEN_BOOK_SHORT_NAMES（与前端一致，如 WQ-L1）。
     */
    @Query("select b from Book b where b.shortName not in :hidden order by b.id asc")
    List<Book> findAllVisible(List<String> hidden);

    /** 按 shortName 批量查（取隐藏词库 id 用）。 */
    List<Book> findByShortNameIn(List<String> shortNames);
}
