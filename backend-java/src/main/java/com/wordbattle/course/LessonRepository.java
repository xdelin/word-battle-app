package com.wordbattle.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LessonRepository extends JpaRepository<Lesson, Integer> {

    /**
     * 课程树关卡查询（接口投影）。别名须与 LessonProjection getter 对应：
     *  id, unitId, title, description, order, isBossLesson, totalChallenges, isCompleted。
     *  order / isBossLesson / isCompleted 为 SQL 关键字或大小写敏感，已用引号/别名处理。
     */
    @Query(value = """
            select l.id as id,
                   l.unit_id as unitId,
                   l.title as title,
                   l.description as description,
                   l."order" as "order",
                   l.is_boss_lesson as isBossLesson,
                   (select count(*) from challenges c where c.lesson_id = l.id) as totalChallenges,
                   coalesce(ulp.is_completed, false) as isCompleted
            from lessons l
            left join user_lesson_progress ulp
                   on ulp.lesson_id = l.id and ulp.user_id = cast(:userId as uuid)
            where l.unit_id in (:unitIds)
            order by l.unit_id, l."order"
            """, nativeQuery = true)
    List<LessonProjection> findTreeLessons(@Param("unitIds") List<Integer> unitIds,
                                           @Param("userId") String userId);
}
