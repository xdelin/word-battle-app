package com.wordbattle.common.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 缓存三件套行为测试：命中 / 空值缓存 / 回源回填 / 互斥锁降级 / Redis 故障 fail-open。 */
@ExtendWith(MockitoExtension.class)
class CacheServiceTest {

    private static final String KEY = "cache:test:key";
    private static final Duration TTL = Duration.ofMinutes(5);
    private static final TypeReference<List<String>> TYPE = new TypeReference<>() {};
    private static final Supplier<List<String>> LOADER = () -> List.of("a", "b");

    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> valueOps;

    CacheService cache;

    @BeforeEach
    void setUp() {
        lenient().when(redis.opsForValue()).thenReturn(valueOps);
        lenient().when(redis.execute(any(RedisScript.class), anyList(), any())).thenReturn(1L);
        cache = new CacheService(redis, new ObjectMapper());
    }

    @Test
    void hit_returnsCachedValue_withoutCallingLoader() {
        when(valueOps.get(KEY)).thenReturn("[\"a\",\"b\"]");

        CacheService.Result<List<String>> r = cache.getOrLoad(KEY, TTL, TYPE, LOADER);

        assertEquals(CacheService.Status.HIT, r.status());
        assertEquals(List.of("a", "b"), r.value());
    }

    @Test
    void nullMarker_returnsNullValue_withNullStatus() {
        when(valueOps.get(KEY)).thenReturn("__NULL__");

        CacheService.Result<List<String>> r = cache.getOrLoad(KEY, TTL, TYPE,
                () -> { throw new AssertionError("loader 不应被调用"); });

        assertEquals(CacheService.Status.NULL, r.status());
        assertNull(r.value());
    }

    @Test
    void miss_loadsAndWritesBack_withJitteredTtl() throws Exception {
        when(valueOps.get(KEY)).thenReturn(null);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);

        CacheService.Result<List<String>> r = cache.getOrLoad(KEY, TTL, TYPE, LOADER);

        assertEquals(CacheService.Status.MISS, r.status());
        assertEquals(List.of("a", "b"), r.value());
        // 回填 TTL 在 base ~ base*1.1 之间（防雪崩抖动）
        verify(valueOps).set(eq(KEY), eq("[\"a\",\"b\"]"), argThat(d ->
                !d.isNegative() && !d.minus(TTL).isNegative() && d.minus(TTL.multipliedBy(11).dividedBy(10)).isNegative()));
    }

    @Test
    void missNullResult_cachesNullMarker() {
        when(valueOps.get(KEY)).thenReturn(null);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);

        CacheService.Result<List<String>> r = cache.getOrLoad(KEY, TTL, TYPE, () -> null);

        assertEquals(CacheService.Status.MISS, r.status());
        assertNull(r.value());
        verify(valueOps).set(eq(KEY), eq("__NULL__"), any(Duration.class));
    }

    @Test
    void lockContention_waitsForRebuild_thenHits() {
        // 第一次读 miss；抢锁失败；等待重读时另一个线程已回填
        when(valueOps.get(KEY)).thenReturn(null, "[\"a\",\"b\"]");
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);

        CacheService.Result<List<String>> r = cache.getOrLoad(KEY, TTL, TYPE,
                () -> { throw new AssertionError("抢锁失败方不应回源"); });

        assertEquals(CacheService.Status.HIT, r.status());
        assertEquals(List.of("a", "b"), r.value());
    }

    @Test
    void lockContention_timeout_fallsBackToDirectLoad() {
        when(valueOps.get(KEY)).thenReturn(null);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);

        CacheService.Result<List<String>> r = cache.getOrLoad(KEY, TTL, TYPE, LOADER);

        assertEquals(CacheService.Status.LOCK_FALLBACK, r.status());
        assertEquals(List.of("a", "b"), r.value());
    }

    @Test
    void redisDown_failsOpen_loadsFromSource() {
        when(valueOps.get(KEY)).thenThrow(new RuntimeException("connection refused"));
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                .thenThrow(new RuntimeException("connection refused"));

        CacheService.Result<List<String>> r = cache.getOrLoad(KEY, TTL, TYPE, LOADER);

        assertEquals(CacheService.Status.DEGRADED, r.status());
        assertEquals(List.of("a", "b"), r.value());
    }

    @Test
    void loaderException_propagates_andReleasesLock() {
        when(valueOps.get(KEY)).thenReturn(null);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);

        assertThrows(IllegalStateException.class,
                () -> cache.getOrLoad(KEY, TTL, TYPE, () -> { throw new IllegalStateException("boom"); }));

        // 锁被释放（Lua 比较删除被调用）
        verify(redis).execute(any(RedisScript.class), anyList(), any());
    }
}
