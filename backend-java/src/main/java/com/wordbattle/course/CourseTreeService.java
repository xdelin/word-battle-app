package com.wordbattle.course;

import com.wordbattle.book.Book;
import com.wordbattle.book.BookRepository;
import com.wordbattle.book.dto.BookResponse;
import com.wordbattle.course.dto.CourseNode;
import com.wordbattle.course.dto.CourseTreeResponse;
import com.wordbattle.course.dto.LessonNode;
import com.wordbattle.course.dto.UnitNode;
import com.wordbattle.user.CurrentUserResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class CourseTreeService {

    private final BookRepository bookRepository;
    private final CourseTreeRepository treeRepository;
    private final CurrentUserResolver currentUser;

    public CourseTreeService(BookRepository bookRepository,
                             CourseTreeRepository treeRepository,
                             CurrentUserResolver currentUser) {
        this.bookRepository = bookRepository;
        this.treeRepository = treeRepository;
        this.currentUser = currentUser;
    }

    public CourseTreeResponse buildTree(Integer bookId) {
        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("词书不存在: " + bookId));

        CourseTreeRepository.CourseTreeData data = treeRepository.loadTree(bookId, currentUser.getUserId());

        // 关卡按 unitId 分组
        Map<Integer, List<LessonProjection>> lessonsByUnit = data.lessons().stream()
                .collect(Collectors.groupingBy(
                        LessonProjection::getUnitId,
                        Collectors.mapping(Function.identity(), Collectors.toList())));

        // 单元按 courseId 分组
        Map<Integer, List<Unit>> unitsByCourse = data.units().stream()
                .collect(Collectors.groupingBy(Unit::getCourseId));

        List<CourseNode> courseNodes = data.courses().stream()
                .map(course -> {
                    List<Unit> courseUnits = unitsByCourse.getOrDefault(course.getId(), List.of());
                    List<UnitNode> unitNodes = courseUnits.stream()
                            .map(unit -> {
                                List<LessonProjection> unitLessons = lessonsByUnit.getOrDefault(unit.getId(), List.of());
                                List<LessonNode> lessonNodes = unitLessons.stream()
                                        .map(this::toLessonNode)
                                        .toList();
                                return new UnitNode(unit.getId(), unit.getTitle(), unit.getDescription(),
                                        unit.getOrder(), lessonNodes);
                            })
                            .toList();
                    return new CourseNode(course.getId(), course.getTitle(), course.getDescription(),
                            course.getOrder(), unitNodes);
                })
                .toList();

        return new CourseTreeResponse(BookResponse.fromEntity(book), courseNodes);
    }

    private LessonNode toLessonNode(LessonProjection l) {
        return new LessonNode(
                l.getId(),
                l.getTitle(),
                l.getDescription(),
                l.getOrder(),
                Boolean.TRUE.equals(l.getIsBossLesson()),
                l.getTotalChallenges() != null ? l.getTotalChallenges() : 0,
                Boolean.TRUE.equals(l.getIsCompleted())
        );
    }
}
