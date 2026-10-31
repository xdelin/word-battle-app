package com.wordbattle.enrich;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Enrich CLI 触发器。
 *
 * 用法：
 *   mvn spring-boot:run -Dspring-boot.run.arguments="--enrich --book CET4 --batch 50"
 *   mvn spring-boot:run -Dspring-boot.run.arguments="--enrich --book CET6 --batch 30 --limit 10 --dry-run"
 *
 * 不传 --enrich 时，应用正常启动 Web 服务（本 runner 直接返回）。
 */
@Component
public class EnrichRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EnrichRunner.class);

    private final EnrichService enrichService;
    private final Environment env;

    public EnrichRunner(EnrichService enrichService, Environment env) {
        this.enrichService = enrichService;
        this.env = env;
    }

    @Override
    public void run(String... args) {
        // 检查是否带 --enrich
        boolean trigger = false;
        for (String a : args) {
            if ("--enrich".equals(a)) {
                trigger = true;
                break;
            }
        }
        if (!trigger) return;

        String book = arg(args, "--book", "CET4");
        int batch = intArg(args, "--batch", 50);
        int limit = intArg(args, "--limit", 0);
        int concurrency = intArg(args, "--concurrency", 3);
        boolean dryRun = hasFlag(args, "--dry-run");

        // LLM 配置兜底：从 env 读（与 TS 脚本一致）
        String baseUrl = env.getProperty("LLM_BASE_URL", "");
        String apiKey = env.getProperty("LLM_API_KEY", "");
        String model = env.getProperty("LLM_MODEL", "glm-5.2");
        if (baseUrl.isEmpty()) baseUrl = env.getProperty("app.llm.base-url", "");
        if (apiKey.isEmpty()) apiKey = env.getProperty("app.llm.api-key", "");

        log.info("=== Enrich 启动 ===");
        log.info("LLM: {} / {} (key {})", baseUrl, model, apiKey.isEmpty() ? "未配置" : "已配置");
        if (apiKey.isEmpty()) {
            log.error("LLM_API_KEY 未配置，无法运行。设环境变量 LLM_API_KEY 或 app.llm.api-key。");
            return;
        }

        int[] result = enrichService.run(book, batch, limit, concurrency, dryRun);
        log.info("=== Enrich 结束：成功 {}，失败 {} ===", result[0], result[1]);

        // CLI 模式：跑完退出 JVM
        System.exit(0);
    }

    private String arg(String[] args, String name, String def) {
        for (int i = 0; i < args.length - 1; i++) {
            if (name.equals(args[i])) return args[i + 1];
        }
        return def;
    }

    private int intArg(String[] args, String name, int def) {
        String v = arg(args, name, null);
        if (v == null) return def;
        try {
            return Integer.parseInt(v);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private boolean hasFlag(String[] args, String name) {
        for (String a : args) {
            if (name.equals(a)) return true;
        }
        return false;
    }
}
