package com.wordbattle.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_stats")
@Getter
@Setter
public class UserStats {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "total_xp")
    private Integer totalXP;

    @Column(name = "current_hearts")
    private Integer currentHearts;

    @Column(name = "max_hearts")
    private Integer maxHearts;

    @Column(name = "power_word_rank")
    private Integer powerWordRank;

    @Column(name = "total_games_played")
    private Integer totalGamesPlayed;

    @Column(name = "games_won")
    private Integer gamesWon;

    @Column(name = "words_learned")
    private Integer wordsLearned;

    @Column(name = "streak_days")
    private Integer streakDays;

    @Column(name = "total_study_days")
    private Integer totalStudyDays;

    @Column(name = "last_study_date")
    private Instant lastStudyDate;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
