package com.wordbattle.auth;

import com.wordbattle.auth.dto.AuthResponse;
import com.wordbattle.auth.dto.LoginRequest;
import com.wordbattle.auth.dto.RegisterRequest;
import com.wordbattle.auth.dto.UserInfo;
import jakarta.persistence.EntityManager;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * 认证服务：注册 / 登录 / 用户信息。
 * 1:1 复刻 actions/auth-actions.ts：bcrypt 哈希 + JWT（30天）+ 建用户统计与设置。
 */
@Service
@Transactional
public class AuthService {

    private static final int BCRYPT_COST = 10;

    private final UserRepository userRepository;
    private final EntityManager em;
    private final JwtUtil jwtUtil;
    private final JwtBlacklistService jwtBlacklist;

    public AuthService(UserRepository userRepository, EntityManager em, JwtUtil jwtUtil,
                       JwtBlacklistService jwtBlacklist) {
        this.userRepository = userRepository;
        this.em = em;
        this.jwtUtil = jwtUtil;
        this.jwtBlacklist = jwtBlacklist;
    }

    public AuthResponse register(RegisterRequest req) {
        // 邮箱已存在
        if (userRepository.findByEmail(req.email()).isPresent()) {
            return AuthResponse.fail("邮箱已被注册");
        }
        // 密码强度（与前端 validatePassword 一致：>=6 位）
        if (req.password() == null || req.password().length() < 6) {
            return AuthResponse.fail("密码至少 6 位");
        }

        UUID userId = UUID.randomUUID();
        String hashed = BCrypt.hashpw(req.password(), BCrypt.gensalt(BCRYPT_COST));

        // 插入用户（原生 SQL，让 DB 默认值生效：created_at/updated_at）
        em.createNativeQuery("""
                insert into users (id, email, name, password, created_at, updated_at)
                values (cast(:id as uuid), :email, :name, :password, now(), now())
                """)
                .setParameter("id", userId.toString())
                .setParameter("email", req.email())
                .setParameter("name", req.name())
                .setParameter("password", hashed)
                .executeUpdate();

        // 建用户统计（与前端 registerUser 一致）
        em.createNativeQuery("""
                insert into user_stats (user_id, total_xp, current_hearts, max_hearts, power_word_rank,
                    total_games_played, games_won, words_learned, streak_days, updated_at)
                values (cast(:uid as uuid), 0, 5, 5, 1200, 0, 0, 0, 0, now())
                """)
                .setParameter("uid", userId.toString())
                .executeUpdate();

        // 建用户设置（与前端一致）
        em.createNativeQuery("""
                insert into user_settings (user_id, daily_goal_minutes, daily_goal_lessons, notifications_enabled,
                    sound_enabled, vibrate_enabled, preferred_difficulty, language_preference, updated_at)
                values (cast(:uid as uuid), 15, 5, true, true, true, 'medium', 'zh-CN', now())
                """)
                .setParameter("uid", userId.toString())
                .executeUpdate();

        String token = jwtUtil.sign(userId.toString());
        return AuthResponse.ok(new UserInfo(userId.toString(), req.email(), req.name(), null), token);
    }

    public AuthResponse login(LoginRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.email());
        if (userOpt.isEmpty()) {
            return AuthResponse.fail("邮箱或密码错误");
        }
        User user = userOpt.get();
        if (user.getPassword() == null || !BCrypt.checkpw(req.password(), user.getPassword())) {
            return AuthResponse.fail("邮箱或密码错误");
        }
        String token = jwtUtil.sign(user.getId().toString());
        return AuthResponse.ok(new UserInfo(
                user.getId().toString(), user.getEmail(), user.getName(), user.getAvatarUrl()), token);
    }

    /** token 验证 + 返回用户信息。 */
    public AuthResponse getUserInfo(String token) {
        if (jwtBlacklist.isBlacklisted(token)) {
            return AuthResponse.fail("token已失效");
        }
        String userId = jwtUtil.verify(token);
        if (userId == null) {
            return AuthResponse.fail("无效的token");
        }
        return userRepository.findById(UUID.fromString(userId))
                .map(u -> AuthResponse.ok(new UserInfo(
                        u.getId().toString(), u.getEmail(), u.getName(), u.getAvatarUrl()), null))
                .orElseGet(() -> AuthResponse.fail("用户不存在"));
    }

    /** 登出：token 进 Redis 黑名单（TTL=剩余有效期）。 */
    public void logout(String token) {
        jwtBlacklist.blacklist(token);
    }
}
