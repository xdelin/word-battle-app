package com.wordbattle.enrich;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wordbattle.enrich.dto.EnrichResult;
import com.wordbattle.enrich.dto.WordCtx;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Enrich 服务：分批调 LLM 为词库生成例句/短语/辨析并写回。
 * 1:1 复刻 scripts/enrich-exam-words.ts。
 */
@Service
public class EnrichService {

    private static final Logger log = LoggerFactory.getLogger(EnrichService.class);
    private static final Pattern FENCE = Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)```");

    private final EnrichRepository repository;
    private final LlmClient llm;
    private final ObjectMapper om;

    public EnrichService(EnrichRepository repository, LlmClient llm, ObjectMapper om) {
        this.repository = repository;
        this.llm = llm;
        this.om = om;
    }

    /** 主流程。返回 [ok, fail]。 */
    public int[] run(String book, int batchSize, int limit, int concurrency, boolean dryRun) {
        log.info("词库: {} | batch={} | concurrency={} | {}", book, batchSize, concurrency, dryRun ? "dry-run" : "正式");
        log.info("查询待生成的词...");
        List<WordCtx> words = fetchWordsNeedingEnrichment(book);
        log.info("待生成: {} 词", words.size());
        if (words.isEmpty()) {
            log.info("没有待生成的词，全部已完成。");
            return new int[]{0, 0};
        }

        List<WordCtx> subset = limit > 0 ? words.subList(0, Math.min(limit, words.size())) : words;
        if (limit > 0) log.info("--limit {}，只处理前 {} 词", limit, subset.size());

        // 预览第一条 prompt
        List<WordCtx> previewBatch = subset.subList(0, Math.min(batchSize, subset.size()));
        log.info("--- prompt 预览（第一批）---\n{}\n--- 预览结束 ---", buildPrompt(previewBatch));

        if (dryRun) {
            log.info("dry-run：不调用 API、不写库。");
            return new int[]{0, 0};
        }

        AtomicInteger ok = new AtomicInteger(0);
        AtomicInteger fail = new AtomicInteger(0);
        AtomicInteger done = new AtomicInteger(0);
        List<List<WordCtx>> batches = chunk(subset, batchSize);

        runPool(batches, concurrency, batch -> {
            try {
                processBatch(batch, ok, fail);
            } catch (Exception e) {
                log.warn("✗ batch 失败 [{}]: {}", batch.stream().map(WordCtx::word).reduce((a, b) -> a + ", " + b).orElse(""), e.getMessage());
                fail.addAndGet(batch.size());
            } finally {
                int d = done.addAndGet(batch.size());
                System.out.printf("  进度 %d/%d（成功 %d 失败 %d）%n", d, subset.size(), ok.get(), fail.get());
            }
        }, 200);

        log.info("完成。成功 {}，失败 {}。失败的可重跑自动续上。", ok.get(), fail.get());
        return new int[]{ok.get(), fail.get()};
    }

    /** 查待 enrich 的词（去重）。 */
    private List<WordCtx> fetchWordsNeedingEnrichment(String book) {
        List<Object[]> rows = repository.findWordsNeedingEnrichment(book);
        List<WordCtx> out = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (Object[] r : rows) {
            String word = r[0] == null ? null : r[0].toString();
            if (word == null || seen.contains(word)) continue;
            seen.add(word);
            out.add(new WordCtx(word,
                    r[1] == null ? null : r[1].toString(),
                    r[2] == null ? null : r[2].toString()));
        }
        return out;
    }

    private String buildPrompt(List<WordCtx> batch) {
        // 构造 input JSON 数组
        List<Map<String, String>> input = new ArrayList<>();
        for (WordCtx w : batch) {
            Map<String, String> m = new HashMap<>();
            m.put("word", w.word());
            m.put("pos", w.pos() == null ? "" : w.pos());
            String trans = w.translation() == null ? "" : w.translation().replace("\\n", " ");
            if (trans.length() > 80) trans = trans.substring(0, 80);
            m.put("translation", trans);
            input.add(m);
        }
        String inputJson;
        try {
            inputJson = om.writeValueAsString(input);
        } catch (Exception e) {
            inputJson = "[]";
        }
        return """
                你是英语词汇教学专家。为下面每个 CET4 单词生成教学内容。

                要求：
                - example_en：一句贴合 CET4 难度的英文例句（10-15 词，展示该词典型用法，必须是原创）
                - example_cn：例句的中文翻译
                - collocations：3-5 个常用短语，每个含 phrase（英文短语）和 meaning（中文释义）
                - discrimination：与 2-3 个近义词的辨析，2-4 句中文

                输入单词（JSON 数组）：
                %s

                严格只输出一个 JSON 数组，不要任何解释、不要代码块标记。每个元素结构：
                [{"word":"abandon","example_en":"...","example_cn":"...","collocations":[{"phrase":"abandon hope","meaning":"放弃希望"}],"discrimination":"abandon / desert / ...：..."}]
                顺序和数量必须与输入一致。""".formatted(inputJson);
    }

    /** 从模型回复抠出 JSON 数组。 */
    private List<EnrichResult> extractJsonArray(String text) throws Exception {
        String t = text == null ? "" : text.trim();
        Matcher m = FENCE.matcher(t);
        if (m.find()) t = m.group(1).trim();
        int start = t.indexOf('[');
        int end = t.lastIndexOf(']');
        if (start == -1 || end == -1 || end <= start) {
            throw new RuntimeException("回复里找不到 JSON 数组");
        }
        String json = t.substring(start, end + 1);
        return om.readValue(json, new TypeReference<>() {});
    }

    /** 校验单个结果。 */
    private EnrichResult validate(EnrichResult raw) {
        if (raw == null || raw.word() == null) return null;
        String en = raw.example_en() == null ? "" : raw.example_en().trim();
        String cn = raw.example_cn() == null ? "" : raw.example_cn().trim();
        String discr = raw.discrimination() == null ? "" : raw.discrimination().trim();
        List<EnrichResult.Collocation> cols = raw.collocations();
        if (en.isEmpty() || cn.isEmpty() || cols == null || cols.isEmpty() || discr.isEmpty()) return null;
        // 过滤空 phrase/meaning
        List<EnrichResult.Collocation> cleanCols = new ArrayList<>();
        for (EnrichResult.Collocation c : cols) {
            if (c.phrase() != null && !c.phrase().isBlank() && c.meaning() != null && !c.meaning().isBlank()) {
                cleanCols.add(new EnrichResult.Collocation(c.phrase().trim(), c.meaning().trim()));
            }
        }
        if (cleanCols.isEmpty()) return null;
        return new EnrichResult(raw.word(), en, cn, cleanCols, discr);
    }

    // 注：processBatch 由 runPool 在多线程中调用，不加 @Transactional（Spring AOP 自调用不生效）。
    // 每次写库走 repository.applyResult 的 @Transactional，保证单条原子性。
    public void processBatch(List<WordCtx> batch, AtomicInteger ok, AtomicInteger fail) throws Exception {
        String prompt = buildPrompt(batch);
        String text = llm.chat(prompt);
        List<EnrichResult> arr = extractJsonArray(text);
        Map<String, EnrichResult> byWord = new HashMap<>();
        for (EnrichResult r : arr) byWord.put(r.word(), r);

        for (WordCtx ctx : batch) {
            EnrichResult validated = validate(byWord.get(ctx.word()));
            if (validated == null) {
                System.out.println("  ✗ " + ctx.word() + " 校验失败/缺失");
                fail.incrementAndGet();
                continue;
            }
            applyResult(validated);
            ok.incrementAndGet();
        }
        log.info("✓ batch done: {}", batch.stream().map(WordCtx::word).reduce((a, b) -> a + ", " + b).orElse(""));
    }

    private void applyResult(EnrichResult r) throws Exception {
        // examples: [{text, translation}]，双层编码字符串
        List<Map<String, String>> examples = List.of(Map.of("text", r.example_en(), "translation", r.example_cn()));
        String examplesJson = om.writeValueAsString(examples);
        // collocations: [{phrase, meaning}]
        List<Map<String, String>> cols = new ArrayList<>();
        for (EnrichResult.Collocation c : r.collocations()) {
            cols.add(Map.of("phrase", c.phrase(), "meaning", c.meaning()));
        }
        String colsJson = om.writeValueAsString(cols);
        repository.applyResult(r.word(), examplesJson, colsJson, r.discrimination());
    }

    /** 分批。 */
    private <T> List<List<T>> chunk(List<T> list, int size) {
        List<List<T>> out = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) {
            out.add(list.subList(i, Math.min(i + size, list.size())));
        }
        return out;
    }

    /** 简易并发池（与 TS runPool 一致：concurrency 个 worker，每批后 delay）。 */
    private <T> void runPool(List<T> items, int concurrency, PoolWorker<T> worker, long delayMs) {
        java.util.concurrent.atomic.AtomicInteger cursor = new java.util.concurrent.atomic.AtomicInteger(0);
        List<Thread> threads = new ArrayList<>();
        int n = Math.min(concurrency, items.size());
        for (int i = 0; i < n; i++) {
            Thread t = new Thread(() -> {
                while (true) {
                    int idx = cursor.getAndIncrement();
                    if (idx >= items.size()) break;
                    try {
                        worker.run(items.get(idx));
                    } catch (Exception e) {
                        log.warn("worker error: {}", e.getMessage());
                    }
                    if (delayMs > 0) {
                        try { Thread.sleep(delayMs); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                    }
                }
            }, "enrich-pool-" + i);
            t.start();
            threads.add(t);
        }
        for (Thread t : threads) {
            try { t.join(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
    }

    @FunctionalInterface
    public interface PoolWorker<T> {
        void run(T item) throws Exception;
    }
}
