package com.wordbattle.enrich;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * dictionary 投影（只读 enrich 所需字段）。word 为主键。
 * examples/collocations 为 jsonb 列，写回时用原生 SQL（cast jsonb）。
 */
@Entity
@Table(name = "dictionary")
@Getter
@Setter
public class DictionaryEnrich {

    @Id
    @Column(name = "word")
    private String word;

    @Column(name = "pos")
    private String pos;

    @Column(name = "translation")
    private String translation;

    // 只读，不映射 examples/collocations/discrimination（写回走原生 SQL）
}
