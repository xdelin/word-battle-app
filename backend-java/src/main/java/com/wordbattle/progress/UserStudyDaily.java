package com.wordbattle.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

/** 每日学习统计。unique(userId, date)。 */
@Entity
@Table(name = "user_study_daily")
@Getter
@Setter
public class UserStudyDaily {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "new_words")
    private Integer newWords;

    @Column(name = "review_words")
    private Integer reviewWords;
}
