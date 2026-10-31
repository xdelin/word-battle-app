package com.wordbattle.common.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * 全局只读数据的缓存组件，覆盖缓存三大经典问题：
 *   穿透 —— 查不到的空结果也缓存（短 TTL 的占位标记），挡住反复打库的无效请求；
 *   击穿 —— 热点 key 过期瞬间，用 SET NX EX 互斥锁保证只有一个线程回源重建，
 *           其余线程短暂等待重读，等不到再自行回源（不阻塞用户请求）；
 *   雪崩 —— TTL 加 0~10% 随机抖动，避免同批 key 同时过期、流量同时打到数据库。
 * 释放锁用 Lua"比较令牌再删"，防止持锁时间过长时误删其他线程的锁。
 * Redis 不可用时 fail-open：直接回源查库，缓存层不参与，接口照常可用。
 */
@Service
public class CacheService {

    /** 空结果占位（防穿透）。 */
    private static final String NULL_MARKER = "__NULL__";
    private static final Duration NULL_TTL = Duration.ofSeconds(60);
    /** 重建锁超时：超过视为持锁线程已挂，锁自动过期允许别人抢。 */
    private static final Duration LOCK_TTL = Duration.ofSeconds(10);
    /** 抢锁失败后的等待重读次数与间隔。 */
    private static final int WAIT_RETRIES = 3;
    private static final long WAIT_MS = 60;

    private static final DefaultRedisScript<Long> UNLOCK_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class);

    public enum Status { HIT, MISS, NULL, LOCK_FALLBACK, DEGRADED }

    public record Result<T>(T value, Status status) {
    }

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public CacheService(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    /**
     * 读缓存，未命中则回源 loader 并回填。
     * loader 抛出的业务异常（如实体不存在）原样上抛，不会被缓存层吞掉。
     */
    public <T> Result<T> getOrLoad(String key, Duration baseTtl, TypeReference<T> type, Supplier<T> loader) {
        // 1) 先读缓存
        Result<T> direct = readThrough(key, type, 0);
        if (direct != null) return direct;

        // 2) 互斥重建：只放一个线程回源，其余线程等一下再读
        String lockKey = "cache:lock:" + key;
        String lockToken = UUID.randomUUID().toString();
        boolean locked;
        try {
            locked = Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(lockKey, lockToken, LOCK_TTL));
        } catch (Exception e) {
            return new Result<>(loader.get(), Status.DEGRADED);
        }
        if (!locked) {
            Result<T> waited = readThrough(key, type, WAIT_RETRIES);
            if (waited != null) return waited;
            return new Result<>(loader.get(), Status.LOCK_FALLBACK);
        }

        try {
            // 双检查：排队等锁的线程进入时，值可能已被上一个持锁线程回填
            Result<T> recheck = readThrough(key, type, 0);
            if (recheck != null) return recheck;

            T value = loader.get();
            try {
                if (value == null) {
                    redis.opsForValue().set(key, NULL_MARKER, NULL_TTL);
                } else {
                    redis.opsForValue().set(key, objectMapper.writeValueAsString(value), withJitter(baseTtl));
                }
            } catch (Exception ignored) {
                // 回填失败不影响本次响应，下次请求重新回源
            }
            return new Result<>(value, Status.MISS);
        } finally {
            try {
                redis.execute(UNLOCK_SCRIPT, List.of(lockKey), lockToken);
            } catch (Exception ignored) {
            }
        }
    }

    /** 读一次缓存，miss 返回 null。waitRounds>0 时每次 miss 稍等再读（等持锁线程回填）。 */
    private <T> Result<T> readThrough(String key, TypeReference<T> type, int waitRounds) {
        for (int i = 0; i <= waitRounds; i++) {
            try {
                String cached = redis.opsForValue().get(key);
                if (cached != null) {
                    if (NULL_MARKER.equals(cached)) return new Result<>(null, Status.NULL);
                    return new Result<>(objectMapper.readValue(cached, type), Status.HIT);
                }
            } catch (Exception e) {
                return null;
            }
            if (i < waitRounds) {
                try {
                    Thread.sleep(WAIT_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return null;
                }
            }
        }
        return null;
    }

    /** TTL 加 0~10% 抖动，避免同批 key 同时过期（雪崩）。 */
    private Duration withJitter(Duration base) {
        long jitterMax = Math.max(1, base.toMillis() / 10);
        return base.plusMillis((long) (Math.random() * jitterMax));
    }
}
