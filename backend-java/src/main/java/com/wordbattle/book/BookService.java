package com.wordbattle.book;

import com.wordbattle.book.dto.BookResponse;
import com.wordbattle.book.dto.LibraryStatsDto;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class BookService {

    /** 隐藏词书 short_name，与前端 HIDDEN_BOOK_SHORT_NAMES 保持一致。 */
    private static final List<String> HIDDEN_BOOK_SHORT_NAMES = List.of("WQ-L1");

    private final BookRepository bookRepository;
    private final EntityManager em;

    public BookService(BookRepository bookRepository, EntityManager em) {
        this.bookRepository = bookRepository;
        this.em = em;
    }

    public List<BookResponse> listVisibleBooks() {
        return bookRepository.findAllVisible(HIDDEN_BOOK_SHORT_NAMES).stream()
                .map(BookResponse::fromEntity)
                .toList();
    }

    public BookResponse getBook(Integer id) {
        return bookRepository.findById(id)
                .map(BookResponse::fromEntity)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("词书不存在: " + id));
    }

    /** 取第一个可见词书（首页"开始学习"直跳用）。 */
    public BookResponse getDefaultBook() {
        return bookRepository.findAllVisible(HIDDEN_BOOK_SHORT_NAMES).stream()
                .findFirst()
                .map(BookResponse::fromEntity)
                .orElse(null);
    }

    /**
     * 首页底部统计：总词数（distinct word）、总关卡数、词库数（均排除隐藏词库）。
     * 与前端 getLibraryStats 一致。
     */
    public LibraryStatsDto getLibraryStats() {
        List<Integer> bookIds = bookRepository.findAllVisible(HIDDEN_BOOK_SHORT_NAMES).stream()
                .map(Book::getId)
                .toList();
        if (bookIds.isEmpty()) {
            return new LibraryStatsDto(0, 0, 0);
        }

        // distinct word 数
        Long totalWords = ((Number) em.createNativeQuery(
                "select count(distinct word) from cards where book_id in (:ids)")
                .setParameter("ids", bookIds)
                .getSingleResult()).longValue();

        // 关卡数（lessons join units join courses，按 bookId 过滤）
        Long totalLessons = ((Number) em.createNativeQuery("""
                select count(*) from lessons l
                join units u on u.id = l.unit_id
                join courses c on c.id = u.course_id
                where c.book_id in (:ids)
                """)
                .setParameter("ids", bookIds)
                .getSingleResult()).longValue();

        return new LibraryStatsDto(totalWords, totalLessons, bookIds.size());
    }
}
