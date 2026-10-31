package com.wordbattle.enrich;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * LLM 客户端：调 OpenAI 兼容的 /chat/completions。
 * 1:1 复刻 TS callLLM：
 *   - temperature 0.3
 *   - thinking disabled（GLM-5.2 推理模型，关掉思考省 token）
 *   - max_tokens 16384
 */
@Component
public class LlmClient {

    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final ObjectMapper om;
    private final HttpClient http;

    public LlmClient(@Value("${app.llm.base-url:}") String baseUrl,
                     @Value("${app.llm.api-key:}") String apiKey,
                     @Value("${app.llm.model:glm-5.2}") String model,
                     ObjectMapper om) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.om = om;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank()
                && apiKey != null && !apiKey.isBlank()
                && model != null && !model.isBlank();
    }

    /** 调 LLM，返回 content 文本。 */
    public String chat(String prompt) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM 未配置（需 app.llm.base-url / api-key / model）");
        }

        ObjectNode body = om.createObjectNode();
        body.put("model", model);
        body.put("temperature", 0.3);
        body.put("max_tokens", 16384);

        ArrayNode messages = body.putArray("messages");
        ObjectNode msg = messages.addObject();
        msg.put("role", "user");
        msg.put("content", prompt);

        // 关掉推理（GLM-5.2）
        ObjectNode thinking = body.putObject("thinking");
        thinking.put("type", "disabled");

        String url = baseUrl.replaceAll("/+$", "") + "/chat/completions";
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(5))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(body)))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            String snippet = resp.body();
            if (snippet != null && snippet.length() > 300) snippet = snippet.substring(0, 300);
            throw new RuntimeException("LLM HTTP " + resp.statusCode() + ": " + snippet);
        }
        JsonNode root = om.readTree(resp.body());
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        return content.isMissingNode() ? "" : content.asText();
    }
}
