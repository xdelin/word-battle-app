package com.wordbattle.wordsearch;

import com.wordbattle.common.ApiResult;
import com.wordbattle.wordsearch.dto.WordSearchWordDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/word-search")
public class WordSearchController {

    private final WordSearchRepository repository;

    public WordSearchController(WordSearchRepository repository) {
        this.repository = repository;
    }

    /** 取某词书的找词词条（默认 8 个，长度 3-7，带中文释义）。 */
    @GetMapping("/words")
    public ApiResult<List<WordSearchWordDto>> getWords(
            @RequestParam Integer bookId,
            @RequestParam(defaultValue = "8") int limit) {
        return ApiResult.ok(repository.pickWords(bookId, limit));
    }
}
