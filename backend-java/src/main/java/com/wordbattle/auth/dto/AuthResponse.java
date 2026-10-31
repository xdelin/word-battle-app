package com.wordbattle.auth.dto;

/** 登录/注册成功响应。 */
public record AuthResponse(
        boolean success,
        String error,
        UserInfo user,
        String token
) {
    public static AuthResponse ok(UserInfo user, String token) {
        return new AuthResponse(true, null, user, token);
    }

    public static AuthResponse fail(String error) {
        return new AuthResponse(false, error, null, null);
    }
}
