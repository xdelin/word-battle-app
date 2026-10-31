package com.wordbattle.user;

import com.wordbattle.auth.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 当前请求所属用户解析。
 *
 * 优先级：Authorization 头的 JWT -> x-test-user-id 头（测试/调试用，模拟不同用户）
 *        -> 配置里的测试用户 ID（兼容未登录浏览）。
 * 接入认证后，所有 controller 经此取 userId，无需各处传参。
 */
@Component
public class CurrentUserResolver {

    private final JwtUtil jwtUtil;
    private final com.wordbattle.auth.JwtBlacklistService jwtBlacklist;
    private final String testUserId;

    public CurrentUserResolver(JwtUtil jwtUtil,
                               com.wordbattle.auth.JwtBlacklistService jwtBlacklist,
                               @Value("${app.test-user-id}") String testUserId) {
        this.jwtUtil = jwtUtil;
        this.jwtBlacklist = jwtBlacklist;
        this.testUserId = testUserId;
    }

    public String getUserId() {
        HttpServletRequest req = currentRequest();
        if (req != null) {
            // 1) 优先从 JWT 取（已登出/被拉黑的 token 视同无效）
            String auth = req.getHeader("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) {
                String token = auth.substring(7);
                String uid = jwtUtil.verify(token);
                if (uid != null && !jwtBlacklist.isBlacklisted(token)) return uid;
            }
            // 2) x-test-user-id header（测试/调试用，模拟不同用户）
            String testHeader = req.getHeader("x-test-user-id");
            if (testHeader != null && !testHeader.isBlank()) {
                return testHeader;
            }
        }
        // 3) 未登录 -> 测试用户（兼容演示/未登录浏览）
        return testUserId;
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attrs == null ? null : attrs.getRequest();
    }
}
