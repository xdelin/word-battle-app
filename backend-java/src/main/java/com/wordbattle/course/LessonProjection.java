package com.wordbattle.course;

import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 关卡投影（原生 SQL 查询结果）。字段别名须与 SQL alias 一致。
 */
public interface LessonProjection {
    Integer getId();
    Integer getUnitId();
    String getTitle();
    String getDescription();
    Integer getOrder();
    Boolean getIsBossLesson();
    Integer getTotalChallenges();
    Boolean getIsCompleted();
}
