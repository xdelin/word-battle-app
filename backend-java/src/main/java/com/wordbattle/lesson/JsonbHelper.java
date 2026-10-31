package com.wordbattle.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

/**
 * jsonb 字段解析助手。
 *
 * dictionary 表的 jsonb 列有两种存储形态：
 *   - 真正的 jsonb 数组（definitions / forms）：原文形如 [{...}]
 *   - jsonb 字符串，即双层编码（examples / collocations）：原文形如 "[{...}]"
 *
 * 本助手统一处理：先解析原文，若得到的是 TextNode（双层编码），再解析其内部字符串。
 */
@Component
public class JsonbHelper {

    private final ObjectMapper om;

    public JsonbHelper(ObjectMapper om) {
        this.om = om;
    }

    public <T> T parse(String raw, TypeReference<T> type) {
        if (raw == null || raw.isBlank()) return null;
        try {
            JsonNode node = om.readTree(raw);
            if (node == null || node.isNull() || node.isMissingNode()) return null;
            // 双层编码：jsonb 字符串 -> 解析内部 JSON
            if (node.isTextual()) {
                node = om.readTree(node.asText());
                if (node == null || node.isNull() || node.isMissingNode()) return null;
            }
            return om.convertValue(node, type);
        } catch (Exception e) {
            // 单条解析失败不应让整节课加载失败
            return null;
        }
    }
}
