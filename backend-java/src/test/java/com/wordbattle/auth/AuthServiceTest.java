package com.wordbattle.auth;

import com.wordbattle.auth.dto.AuthResponse;
import com.wordbattle.auth.dto.LoginRequest;
import com.wordbattle.auth.dto.RegisterRequest;
import com.wordbattle.auth.dto.UserInfo;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mindrot.jbcrypt.BCrypt;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 注册/登录/登出黑名单逻辑单元测试（DB 与 JWT 全部 mock）。 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock EntityManager em;
    @Mock JwtUtil jwtUtil;
    @Mock JwtBlacklistService jwtBlacklist;
    @Mock Query nativeQuery;

    AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(userRepository, em, jwtUtil, jwtBlacklist);
    }

    private User user(String email, String rawPassword) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setEmail(email);
        u.setName("小明");
        if (rawPassword != null) u.setPassword(BCrypt.hashpw(rawPassword, BCrypt.gensalt(10)));
        return u;
    }

    // ---- 注册 ----

    @Test
    void register_duplicateEmail_fails() {
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user("a@b.com", null)));
        AuthResponse r = service.register(new RegisterRequest("a@b.com", "小明", "secret123"));
        assertFalse(r.success());
        assertEquals("邮箱已被注册", r.error());
        verify(em, never()).createNativeQuery(anyString());
    }

    @Test
    void register_shortPassword_fails() {
        AuthResponse r = service.register(new RegisterRequest("a@b.com", "小明", "12345"));
        assertFalse(r.success());
        assertEquals("密码至少 6 位", r.error());
        verify(em, never()).createNativeQuery(anyString());
    }

    @Test
    void register_success_insertsUserStatsSettings_andSignsToken() {
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.empty());
        when(em.createNativeQuery(anyString())).thenReturn(nativeQuery);
        when(nativeQuery.setParameter(anyString(), any())).thenReturn(nativeQuery);
        when(jwtUtil.sign(anyString())).thenReturn("tok-123");

        AuthResponse r = service.register(new RegisterRequest("a@b.com", "小明", "secret123"));

        assertTrue(r.success());
        assertNotNull(r.user());
        assertEquals("a@b.com", r.user().email());
        assertEquals("tok-123", r.token());
        // users / user_stats / user_settings 三条插入 + 密码是 bcrypt 哈希（不是明文）
        verify(em, times(3)).createNativeQuery(anyString());
        verify(nativeQuery, times(3)).executeUpdate();
        verify(em).createNativeQuery(contains("insert into users"));
        verify(em).createNativeQuery(contains("insert into user_stats"));
        verify(em).createNativeQuery(contains("insert into user_settings"));
        verify(nativeQuery).setParameter(eq("password"), argThat(v -> v instanceof String s && s.startsWith("$2")));
        // 签发的 userId 是合法 UUID
        verify(jwtUtil).sign(argThat(id -> {
            try { UUID.fromString((String) id); return true; } catch (Exception e) { return false; }
        }));
    }

    // ---- 登录 ----

    @Test
    void login_unknownEmail_fails() {
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.empty());
        AuthResponse r = service.login(new LoginRequest("a@b.com", "secret123"));
        assertFalse(r.success());
        assertEquals("邮箱或密码错误", r.error());
    }

    @Test
    void login_wrongPassword_fails() {
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user("a@b.com", "secret123")));
        AuthResponse r = service.login(new LoginRequest("a@b.com", "wrong-pass"));
        assertFalse(r.success());
        assertEquals("邮箱或密码错误", r.error());
    }

    @Test
    void login_nullPassword_fails() {
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user("a@b.com", null)));
        AuthResponse r = service.login(new LoginRequest("a@b.com", "secret123"));
        assertFalse(r.success());
    }

    @Test
    void login_success_returnsToken() {
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user("a@b.com", "secret123")));
        when(jwtUtil.sign(anyString())).thenReturn("tok-123");
        AuthResponse r = service.login(new LoginRequest("a@b.com", "secret123"));
        assertTrue(r.success());
        assertEquals("tok-123", r.token());
        assertEquals("小明", r.user().name());
    }

    // ---- me / 黑名单 ----

    @Test
    void me_blacklistedToken_fails() {
        when(jwtBlacklist.isBlacklisted("tok-1")).thenReturn(true);
        AuthResponse r = service.getUserInfo("tok-1");
        assertFalse(r.success());
        assertEquals("token已失效", r.error());
        verify(jwtUtil, never()).verify(anyString());
    }

    @Test
    void me_invalidToken_fails() {
        when(jwtBlacklist.isBlacklisted("bad")).thenReturn(false);
        when(jwtUtil.verify("bad")).thenReturn(null);
        AuthResponse r = service.getUserInfo("bad");
        assertFalse(r.success());
        assertEquals("无效的token", r.error());
    }

    @Test
    void me_validToken_returnsUser() {
        UUID uid = UUID.randomUUID();
        User u = user("a@b.com", null);
        u.setId(uid);
        when(jwtBlacklist.isBlacklisted("tok-1")).thenReturn(false);
        when(jwtUtil.verify("tok-1")).thenReturn(uid.toString());
        when(userRepository.findById(uid)).thenReturn(Optional.of(u));
        AuthResponse r = service.getUserInfo("tok-1");
        assertTrue(r.success());
        assertEquals(uid.toString(), r.user().id());
        assertNull(r.token()); // me 不续签
    }

    // ---- 登出 ----

    @Test
    void logout_blacklistsToken() {
        service.logout("tok-1");
        verify(jwtBlacklist).blacklist("tok-1");
    }
}
