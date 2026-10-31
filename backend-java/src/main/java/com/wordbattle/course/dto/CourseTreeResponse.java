package com.wordbattle.course.dto;

import com.wordbattle.book.dto.BookResponse;
import java.util.List;

/**
 * 整棵课程树：词书 -> 课程 -> 单元 -> 关卡。
 * 前端课程页只用第一门课程（courses[0]），此处返回全部以备扩展。
 */
public record CourseTreeResponse(
        BookResponse book,
        List<CourseNode> courses
) {
}
