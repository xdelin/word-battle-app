package com.wordbattle.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 签发与验证。与前端 jsonwebtoken 行为对齐：
 *   payload: { userId }，过期 30 天。
 *   签名算法：HS256（前端默认），密钥用 JWT_SECRET 配置。
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                  @Value("${app.jwt.expiration-days:30}") long expirationDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationDays * 24 * 60 * 60 * 1000L;
    }

    public String sign(String userId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId)
                .claim("userId", userId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    /** 验证并返回 userId；无效返回 null。 */
    public String verify(String token) {
        if (token == null || token.isBlank()) return null;
        try {
            Claims c = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return c.get("userId", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** token 剩余有效秒数；无效/已过期返回 0。 */
    public long getRemainingSeconds(String token) {
        if (token == null || token.isBlank()) return 0;
        try {
            Claims c = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Math.max(0, (c.getExpiration().getTime() - System.currentTimeMillis()) / 1000);
        } catch (Exception e) {
            return 0;
        }
    }
}
