-- PK 房间座位号：joinRoom 竞态下防止超卖/重复入座
ALTER TABLE pk_room_users ADD COLUMN IF NOT EXISTS seat_no smallint;

-- (room_id, seat_no) 唯一：同一房间同一座位只能被占一次
CREATE UNIQUE INDEX IF NOT EXISTS pk_room_users_room_seat_uk
    ON pk_room_users (room_id, seat_no) WHERE seat_no IS NOT NULL;

-- (room_id, user_id) 唯一：同一用户不能在同一房间重复入座（防双击/并发重复 join）
CREATE UNIQUE INDEX IF NOT EXISTS pk_room_users_room_user_uk
    ON pk_room_users (room_id, user_id);
