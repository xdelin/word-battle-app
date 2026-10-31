package com.wordbattle.pk;

import com.wordbattle.pk.dto.LeaderboardEntryDto;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 词力值排行榜（Redis ZSET）：member=userId，score=power_word_rank，名称存 HASH。
 * Redis 不可用时 fail-open：写入静默丢弃、查询返回空列表，不影响对局与主流程。
 */
@Service
public class LeaderboardService {

    private static final String ZSET_KEY = "leaderboard:power";
    private static final String NAME_HASH_KEY = "leaderboard:names";

    private final StringRedisTemplate redis;

    public LeaderboardService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** 对局结算后写入新词力值。NPC 不上榜。 */
    public void recordRank(String userId, String name, int newRank) {
        if (PkUtils.NPC_USER_ID.equals(userId)) return;
        try {
            redis.opsForZSet().add(ZSET_KEY, userId, newRank);
            if (name != null && !name.isBlank()) {
                redis.opsForHash().put(NAME_HASH_KEY, userId, name);
            }
        } catch (Exception ignored) {
            // Redis 挂了不影响结算
        }
    }

    /** Top N（按词力值倒序）。 */
    public List<LeaderboardEntryDto> top(int limit) {
        try {
            Set<String> members = redis.opsForZSet().reverseRange(ZSET_KEY, 0, Math.max(0, limit - 1));
            if (members == null || members.isEmpty()) return List.of();
            List<LeaderboardEntryDto> out = new ArrayList<>(members.size());
            int rank = 1;
            for (String userId : members) {
                Double score = redis.opsForZSet().score(ZSET_KEY, userId);
                Object name = redis.opsForHash().get(NAME_HASH_KEY, userId);
                out.add(new LeaderboardEntryDto(userId,
                        name == null ? "匿名选手" : name.toString(),
                        score == null ? 0 : score.intValue(), rank++));
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 某用户的词力值名次（1 开始）；未上榜/Redis 不可用返回 null。 */
    public Integer getUserRank(String userId) {
        try {
            Long r = redis.opsForZSet().reverseRank(ZSET_KEY, userId);
            return r == null ? null : r.intValue() + 1;
        } catch (Exception e) {
            return null;
        }
    }
}
