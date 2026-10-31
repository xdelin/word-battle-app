package com.wordbattle.book.dto;

import com.wordbattle.book.Book;
import java.time.Instant;

/**
 * 词书列表/详情响应。
 */
public record BookResponse(
        Integer id,
        String name,
        String shortName,
        String description,
        String level,
        String category,
        String imageUrl,
        Integer totalWords,
        Instant createdAt
) {
    public static BookResponse fromEntity(Book b) {
        return new BookResponse(
                b.getId(), b.getName(), b.getShortName(), b.getDescription(),
                b.getLevel(), b.getCategory(), b.getImageUrl(),
                b.getTotalWords(), b.getCreatedAt()
        );
    }
}
