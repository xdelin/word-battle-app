package com.wordbattle.pk;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * PK 用户幂等创建。PK 的 userId 来自浏览器（localStorage），可能不在 users 表里，
 * 写 FK 前必须确保用户存在。
 *
 * 与 actions/pk-actions.ts 的 ensurePlayerUser / ensureNpcUser 对齐。
 * 进程内缓存已确认的 userId，避免每次开局都 SELECT。
 */
@Component
public class PkUserEnsure {

    private final EntityManager em;
    private final ConcurrentHashMap<String, Boolean> ensured = new ConcurrentHashMap<>();

    public PkUserEnsure(EntityManager em) {
        this.em = em;
    }

    @Transactional
    public void ensurePlayer(String userId, String name) {
        if (userId == null || userId.isBlank()) return;
        if (ensured.containsKey(userId)) return;
        ensureInternal(userId, name == null || name.isBlank() ? "玩家" : name);
        ensured.put(userId, true);
    }

    @Transactional
    public void ensureNpc() {
        String npcId = PkUtils.NPC_USER_ID;
        if (ensured.containsKey(npcId)) return;
        ensureInternal(npcId, PkUtils.NPC_USER_NAME);
        // NPC stats：powerWordRank=1200, hearts=99
        Integer cnt = ((Number) em.createNativeQuery("select count(*) from user_stats where user_id = cast(? as uuid)")
                .setParameter(1, npcId).getSingleResult()).intValue();
        if (cnt == 0) {
            em.createNativeQuery("insert into user_stats (user_id, total_xp, current_hearts, max_hearts, power_word_rank, total_games_played, games_won, words_learned, streak_days) values (cast(? as uuid), 0, 99, 99, 1200, 0, 0, 0, 0)")
                    .setParameter(1, npcId).executeUpdate();
        }
        ensured.put(npcId, true);
    }

    private void ensureInternal(String userId, String name) {
        Integer cnt = ((Number) em.createNativeQuery("select count(*) from users where id = cast(? as uuid)")
                .setParameter(1, userId).getSingleResult()).intValue();
        if (cnt > 0) return;
        String email = "user-" + userId.substring(0, Math.min(8, userId.length())) + "@word-battle.app";
        em.createNativeQuery("insert into users (id, email, name) values (cast(? as uuid), ?, ?)")
                .setParameter(1, userId)
                .setParameter(2, email)
                .setParameter(3, name)
                .executeUpdate();
        em.createNativeQuery("insert into user_stats (user_id, total_xp, current_hearts, max_hearts, power_word_rank, total_games_played, games_won, words_learned, streak_days) values (cast(? as uuid), 0, 5, 5, 1200, 0, 0, 0, 0)")
                .setParameter(1, userId).executeUpdate();
    }

    /** 失败时清缓存，允许重试。 */
    public void invalidate(String userId) {
        ensured.remove(userId);
    }
}
