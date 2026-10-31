package com.wordbattle.common;

/**
 * 统一响应封装。
 * 成功：{ code: 0, data: ... }
 * 失败：{ code: <非0>, message: "...", data: null }
 */
public record ApiResult<T>(int code, String message, T data) {

    public static <T> ApiResult<T> ok(T data) {
        return new ApiResult<>(0, "ok", data);
    }

    public static <T> ApiResult<T> ok() {
        return new ApiResult<>(0, "ok", null);
    }

    public static <T> ApiResult<T> error(int code, String message) {
        return new ApiResult<>(code, message, null);
    }
}
