package com.wordbattle.auth;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

/**
 * JWT 登出黑名单：token 的 SHA-256 摘要 -> Redis SET，TTL = token 剩余有效期。
 * Redis 不可用时 fail-open（放行）：只损失登出时效性，不影响登录态可用性。
 */
@Service
public class JwtBlacklistService {

    private static final String KEY_PREFIX = "jwt:blacklist:";

    private final StringRedisTemplate redis;
    private final JwtUtil jwtUtil;

    public JwtBlacklistService(StringRedisTemplate redis, JwtUtil jwtUtil) {
        this.redis = redis;
        this.jwtUtil = jwtUtil;
    }

    /** 登出：拉黑当前 token，到 token 自然过期时自动清除。 */
    public void blacklist(String token) {
        try {
            long ttl = jwtUtil.getRemainingSeconds(token);
            if (ttl <= 0) return;
            redis.opsForValue().set(KEY_PREFIX + sha256(token), "1", Duration.ofSeconds(ttl));
        } catch (Exception ignored) {
            // fail-open：Redis 挂了登出请求也不报错
        }
    }

    public boolean isBlacklisted(String token) {
        try {
            return Boolean.TRUE.equals(redis.hasKey(KEY_PREFIX + sha256(token)));
        } catch (Exception e) {
            return false; // fail-open
        }
    }

    private String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
