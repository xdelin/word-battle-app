package com.wordbattle.pk;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * PK 房间 WebSocket：连接 /ws/pk?roomId=xxx 即订阅该房间。
 * 对手提交答案时推送 {type:"opponent-answered", roomId, questionId, userId}，
 * 前端收到后立即拉取一次答题记录（HTTP 轮询保留作降级）。
 */
@Component
public class PkSocketHandler extends TextWebSocketHandler {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String roomId = roomOf(session);
        if (roomId == null) {
            try { session.close(CloseStatus.BAD_DATA); } catch (Exception ignored) {}
            return;
        }
        rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = roomOf(session);
        if (roomId == null) return;
        Set<WebSocketSession> sessions = rooms.get(roomId);
        if (sessions != null) sessions.remove(session);
    }

    /** 对手已作答：推给房间内所有连接（含自己，前端按 userId 过滤）。 */
    public void notifyOpponentAnswered(String roomId, String questionId, String userId) {
        Set<WebSocketSession> sessions = rooms.get(roomId);
        if (sessions == null || sessions.isEmpty()) return;
        String payload;
        try {
            payload = MAPPER.writeValueAsString(Map.of(
                    "type", "opponent-answered",
                    "roomId", roomId == null ? "" : roomId,
                    "questionId", questionId == null ? "" : questionId,
                    "userId", userId == null ? "" : userId));
        } catch (Exception e) {
            return;
        }
        for (WebSocketSession s : sessions) {
            try {
                if (s.isOpen()) {
                    synchronized (s) {
                        s.sendMessage(new TextMessage(payload));
                    }
                }
            } catch (Exception ignored) {
                // 单个连接挂了不影响其他订阅者
            }
        }
    }

    private String roomOf(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null) return null;
        for (String p : uri.getQuery().split("&")) {
            if (p.startsWith("roomId=")) return p.substring("roomId=".length());
        }
        return null;
    }
}
