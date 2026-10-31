package com.wordbattle.review;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserMasteredWordRepository extends JpaRepository<UserMasteredWord, UUID> {

    Optional<UserMasteredWord> findByUserIdAndWord(UUID userId, String word);
}
