package com.wordbattle.book;

import com.fasterxml.jackson.core.type.TypeReference;
import com.wordbattle.book.dto.BookResponse;
import com.wordbattle.book.dto.LibraryStatsDto;
import com.wordbattle.common.ApiResult;
import com.wordbattle.common.cache.CacheService;
import com.wordbattle.course.CourseTreeService;
import com.wordbattle.course.dto.CourseTreeResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/books")
public class BookController {

    /** 词书数据基本只随导入变化，缓存 10min；统计涉及聚合查询，缓存 5min。 */
    private static final Duration BOOK_TTL = Duration.ofMinutes(10);
    private static final Duration STATS_TTL = Duration.ofMinutes(5);

    private final BookService bookService;
    private final CourseTreeService courseTreeService;
    private final CacheService cache;

    public BookController(BookService bookService, CourseTreeService courseTreeService, CacheService cache) {
        this.bookService = bookService;
        this.courseTreeService = courseTreeService;
        this.cache = cache;
    }

    /** 词书列表（不含隐藏词书）。全局数据，走缓存三件套（防穿透/击穿/雪崩），响应带 X-Cache 头。 */
    @GetMapping
    public ResponseEntity<ApiResult<List<BookResponse>>> listBooks() {
        return respond(cache.getOrLoad("cache:books:list", BOOK_TTL,
                new TypeReference<List<BookResponse>>() {}, bookService::listVisibleBooks));
    }

    /** 词书详情。 */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResult<BookResponse>> getBook(@PathVariable Integer id) {
        return respond(cache.getOrLoad("cache:book:" + id, BOOK_TTL,
                new TypeReference<BookResponse>() {}, () -> bookService.getBook(id)));
    }

    /** 词书的整棵课程树（课程 -> 单元 -> 关卡，含当前用户进度）。
     *  loadTree 依赖当前用户（进度列 isCompleted），是用户级数据，绝不走全局缓存。 */
    @GetMapping("/{bookId}/course-tree")
    public ApiResult<CourseTreeResponse> getCourseTree(@PathVariable Integer bookId) {
        return ApiResult.ok(courseTreeService.buildTree(bookId));
    }

    /** 默认词书（第一个可见词书，首页"开始学习"用）。可能没有词书 -> 走空值缓存防穿透。 */
    @GetMapping("/default")
    public ResponseEntity<ApiResult<BookResponse>> getDefaultBook() {
        return respond(cache.getOrLoad("cache:book:default", BOOK_TTL,
                new TypeReference<BookResponse>() {}, bookService::getDefaultBook));
    }

    /** 首页底部统计：总词数、总关卡数、词库数（排除隐藏词库）。 */
    @GetMapping("/library/stats")
    public ResponseEntity<ApiResult<LibraryStatsDto>> getLibraryStats() {
        return respond(cache.getOrLoad("cache:library:stats", STATS_TTL,
                new TypeReference<LibraryStatsDto>() {}, bookService::getLibraryStats));
    }

    private <T> ResponseEntity<ApiResult<T>> respond(CacheService.Result<T> r) {
        return ResponseEntity.ok()
                .header("X-Cache", r.status().name())
                .body(ApiResult.ok(r.value()));
    }
}
