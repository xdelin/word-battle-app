package com.wordbattle.book;

import com.wordbattle.book.dto.BookResponse;
import com.wordbattle.book.dto.LibraryStatsDto;
import com.wordbattle.common.ApiResult;
import com.wordbattle.course.CourseTreeService;
import com.wordbattle.course.dto.CourseTreeResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;
    private final CourseTreeService courseTreeService;

    public BookController(BookService bookService, CourseTreeService courseTreeService) {
        this.bookService = bookService;
        this.courseTreeService = courseTreeService;
    }

    /** 词书列表（不含隐藏词书）。 */
    @GetMapping
    public ApiResult<List<BookResponse>> listBooks() {
        return ApiResult.ok(bookService.listVisibleBooks());
    }

    /** 词书详情。 */
    @GetMapping("/{id}")
    public ApiResult<BookResponse> getBook(@PathVariable Integer id) {
        return ApiResult.ok(bookService.getBook(id));
    }

    /** 词书的整棵课程树（课程 -> 单元 -> 关卡，含当前用户进度）。 */
    @GetMapping("/{bookId}/course-tree")
    public ApiResult<CourseTreeResponse> getCourseTree(@PathVariable Integer bookId) {
        return ApiResult.ok(courseTreeService.buildTree(bookId));
    }

    /** 默认词书（第一个可见词书，首页"开始学习"用）。 */
    @GetMapping("/default")
    public ApiResult<BookResponse> getDefaultBook() {
        return ApiResult.ok(bookService.getDefaultBook());
    }

    /** 首页底部统计：总词数、总关卡数、词库数（排除隐藏词库）。 */
    @GetMapping("/library/stats")
    public ApiResult<LibraryStatsDto> getLibraryStats() {
        return ApiResult.ok(bookService.getLibraryStats());
    }
}
