package com.wordbattle.course;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 课程树查询（只读）：Course / Unit 走 JPQL（实体），Lesson 走 LessonRepository（接口投影原生 SQL）。
 */
@Repository
@Transactional(readOnly = true)
public class CourseTreeRepository {

    private final EntityManager em;
    private final LessonRepository lessonRepository;

    public CourseTreeRepository(EntityManager em, LessonRepository lessonRepository) {
        this.em = em;
        this.lessonRepository = lessonRepository;
    }

    public List<Course> findCoursesByBookId(Integer bookId) {
        return em.createQuery(
                        "select c from Course c where c.bookId = :bookId order by c.order asc", Course.class)
                .setParameter("bookId", bookId)
                .getResultList();
    }

    public List<Unit> findUnitsByCourseIds(List<Integer> courseIds) {
        if (courseIds == null || courseIds.isEmpty()) return List.of();
        return em.createQuery(
                        "select u from Unit u where u.courseId in :ids order by u.order asc", Unit.class)
                .setParameter("ids", courseIds)
                .getResultList();
    }

    public List<LessonProjection> findTreeLessons(List<Integer> unitIds, String userId) {
        if (unitIds == null || unitIds.isEmpty()) return List.of();
        return lessonRepository.findTreeLessons(unitIds, userId);
    }

    /** 一次方法调里取齐三层，减少往返。 */
    public CourseTreeData loadTree(Integer bookId, String userId) {
        List<Course> courses = findCoursesByBookId(bookId);
        List<Integer> courseIds = courses.stream().map(Course::getId).toList();
        List<Unit> units = findUnitsByCourseIds(courseIds);
        List<Integer> unitIds = units.stream().map(Unit::getId).toList();
        List<LessonProjection> lessons = findTreeLessons(unitIds, userId);
        return new CourseTreeData(courses, units, lessons);
    }

    public record CourseTreeData(
            List<Course> courses,
            List<Unit> units,
            List<LessonProjection> lessons
    ) {
    }
}
