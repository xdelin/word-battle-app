package com.wordbattle.pk.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * pk_room_questions.options 列的存储结构（jsonb）。
 * 把题干音标 phonetic 和选项列表一起存入 options 列，避免新增表列；
 * 生成时写入，回读（好友模式轮询）时解析，无需重算。
 */
public record PkOptionsPayload(
        @JsonProperty("phonetic") String phonetic,
        @JsonProperty("options") List<PkOptionDto> options
) {
}
