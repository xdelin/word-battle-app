package com.wordbattle.pk;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

/**
 * 提交答案的幂等门闩（Redis Lua）。
 *
 * 问题背景：网络重试 / 超时重发 / 快速双击会让同一题的"提交答案"到达后端多次。
 * 仅靠 DB 查重有两个缺口：并发窗口内两次请求都查到"未作答"然后各插一条；
 * 且每次重复请求都要打到数据库。
 *
 * 方案：Lua 脚本原子地"检查 key 是否存在 -> 不存在则占位写入"（比 SETNX 多一步带回旧值），
 * 同一 requestId 只有一个请求能拿到 FIRST；业务落库成功后把结果 JSON 回写进同一个 key，
 * 重复请求直接返回上次结果，不打 DB。结果回写放在事务提交之后（afterCommit），
 * 保证重复请求拿到的一定是已提交的数据。
 *
 * Redis 不可用时 fail-open：放行请求，退化为 DB 层查重兜底。
 */
@Service
public class AnswerIdempotencyService {

    private static final Duration TTL = Duration.ofHours(24);
    private static final String PLACEHOLDER = "processing";

    /**
     * KEYS[1]=幂等键  ARGV[1]=占位值  ARGV[2]=TTL 秒
     * 返回 {first, value}：first=1 首次（已占位），first=0 重复（value 为已存内容）。
     * 单脚本保证"检查 + 占位"原子性，避免 EXISTS 与 SET 之间的竞态。
     */
    private static final DefaultRedisScript<List> CLAIM_SCRIPT = new DefaultRedisScript<>(
            """
            if redis.call('exists', KEYS[1]) == 1 then
              return {0, redis.call('get', KEYS[1])}
            else
              redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
              return {1, ''}
            end
            """,
            List.class);

    public enum Kind { FIRST, DUPLICATE }

    public record Claim(Kind kind, String cachedJson) {
    }

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public AnswerIdempotencyService(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    /** 首次请求占位并放行；重复请求拿到已存的结果 JSON（可能还是占位符，说明首个请求仍在途）。 */
    @SuppressWarnings("unchecked")
    public Claim claim(String requestId) {
        try {
            List<Object> r = redis.execute(
                    CLAIM_SCRIPT, List.of(key(requestId)), PLACEHOLDER, String.valueOf(TTL.toSeconds()));
            boolean first = r != null && !r.isEmpty()
                    && ((Number) r.get(0)).longValue() == 1L;
            if (first) return new Claim(Kind.FIRST, null);
            String value = r != null && r.size() > 1 && r.get(1) != null ? r.get(1).toString() : null;
            return new Claim(Kind.DUPLICATE, PLACEHOLDER.equals(value) ? null : value);
        } catch (Exception e) {
            return new Claim(Kind.FIRST, null);
        }
    }

    /** 业务落库成功后回写结果（事务提交后调用），供重复请求直接返回。 */
    public void storeResult(String requestId, Object result) {
        try {
            redis.opsForValue().set(key(requestId), objectMapper.writeValueAsString(result), TTL);
        } catch (Exception ignored) {
            // 回写失败不影响本次响应；重复请求会走 DB 查重兜底
        }
    }

    private String key(String requestId) {
        return "pk:idem:" + requestId;
    }
}
