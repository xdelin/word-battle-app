package com.wordbattle.auth.dto;

public record UserInfo(
        String id,
        String email,
        String name,
        String avatarUrl
) {
}
