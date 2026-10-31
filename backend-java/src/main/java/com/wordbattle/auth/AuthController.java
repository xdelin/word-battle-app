package com.wordbattle.auth;

import com.wordbattle.auth.dto.AuthResponse;
import com.wordbattle.auth.dto.LoginRequest;
import com.wordbattle.auth.dto.RegisterRequest;
import com.wordbattle.common.ApiResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** 注册。 */
    @PostMapping("/register")
    public ApiResult<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ApiResult.ok(authService.register(req));
    }

    /** 登录。 */
    @PostMapping("/login")
    public ApiResult<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return ApiResult.ok(authService.login(req));
    }

    /** 验证 token 并返回用户信息。 */
    @GetMapping("/me")
    public ApiResult<AuthResponse> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        String token = extractToken(auth);
        if (token == null) {
            return ApiResult.ok(AuthResponse.fail("未提供认证token"));
        }
        return ApiResult.ok(authService.getUserInfo(token));
    }

    /** 登出：token 进 Redis 黑名单（TTL=剩余有效期）。 */
    @PostMapping("/logout")
    public ApiResult<Void> logout(@RequestHeader(value = "Authorization", required = false) String auth) {
        String token = extractToken(auth);
        if (token != null) {
            authService.logout(token);
        }
        return ApiResult.ok(null);
    }

    private String extractToken(String auth) {
        if (auth == null || auth.isBlank()) return null;
        if (auth.startsWith("Bearer ")) return auth.substring(7);
        return auth;
    }
}
