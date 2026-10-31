package com.wordbattle.pk;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PkRoomRepository extends JpaRepository<PkRoom, UUID> {

    Optional<PkRoom> findByRoomCode(String roomCode);

    /**
     * 悲观锁读房间行：joinRoom 先锁行再检查人数/插入座位，
     * 串行化并发 join（check-then-act 竞态），与 (room_id, seat_no) 唯一索引双保险。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PkRoom r where r.roomCode = :code")
    Optional<PkRoom> findByRoomCodeForUpdate(@Param("code") String code);

    List<PkRoom> findByTypeAndStatus(String type, String status);
}
