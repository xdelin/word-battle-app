#!/usr/bin/env node
/**
 * 零依赖压测脚本（Node 内置 http 模块）。
 *
 * 用法：
 *   node scripts/bench.mjs                      # 默认场景全跑
 *   node scripts/bench.mjs /api/books           # 只压一个路径
 *
 * 每个场景：固定并发连接池压 n 个请求，记录单请求延迟，输出 QPS / P50 / P95 / P99。
 * 冷启动对比：压测前可用 redis-cli DEL cache:* 后单发请求测"回源"延迟（见 README 性能一节）。
 */
import http from "node:http";
import fs from "node:fs";

const BASE = process.env.BENCH_BASE || "http://localhost:8080";
const N = Number(process.env.BENCH_N || 2000);
const C = Number(process.env.BENCH_C || 50);
const TOKEN = (() => {
  try { return fs.readFileSync("/tmp/wb-token.txt", "utf8").trim(); } catch { return null; }
})();

const PATHS = process.argv[2]
  ? [process.argv[2]]
  : ["/api/books", "/api/books/library/stats", "/api/review", "/api/books/18/course-tree"];

function requestOnce(path) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.request(
      `${BASE}${path}`,
      {
        method: "GET",
        agent: new http.Agent({ keepAlive: true, maxSockets: C }),
        headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
        timeout: 15000,
      },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve({ status: res.statusCode, ms: performance.now() - start }));
      },
    );
    req.on("error", (e) => resolve({ status: 0, ms: performance.now() - start, error: String(e) }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, ms: performance.now() - start, error: "timeout" }); });
    req.end();
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function bench(path) {
  let done = 0;
  const latencies = [];
  const errors = { 0: 0 };
  const start = performance.now();
  await Promise.all(
    Array.from({ length: C }, async () => {
      while (done < N) {
        const r = await requestOnce(path);
        latencies.push(r.ms);
        if (r.status !== 200) {
          errors[r.status] = (errors[r.status] || 0) + 1;
        }
        done++;
      }
    }),
  );
  const wall = (performance.now() - start) / 1000;
  latencies.sort((a, b) => a - b);
  return {
    path,
    requests: N,
    concurrency: C,
    qps: Math.round(N / wall),
    wallSec: Number(wall.toFixed(2)),
    p50: Math.round(percentile(latencies, 50)),
    p95: Math.round(percentile(latencies, 95)),
    p99: Math.round(percentile(latencies, 99)),
    max: Math.round(latencies[latencies.length - 1] || 0),
    non200: errors,
  };
}

async function warmup(path, times = 20) {
  for (let i = 0; i < times; i++) await requestOnce(path);
}

for (const p of PATHS) {
  await warmup(p);
  const r = await bench(p);
  console.log(JSON.stringify(r));
}
