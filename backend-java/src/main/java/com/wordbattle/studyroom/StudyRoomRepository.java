package com.wordbattle.studyroom;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudyRoomRepository extends JpaRepository<StudyRoom, UUID> {

    Optional<StudyRoom> findByCode(String code);

    /** 广场：公开自习室，按创建时间倒序。 */
    List<StudyRoom> findByIsPublicTrueOrderByCreatedAtDesc();
}
