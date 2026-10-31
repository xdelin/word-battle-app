# 前后端分离迁移方案（Next.js + Java Spring Boot 3）

## 目标
- 后端从 Next.js（server actions / API routes）迁移到 **Java Spring Boot 3**，支撑高并发上线。
- 前端保留 Next.js，但去掉 server component / DB 直连，改成**纯客户端 + fetch 调 Java API**。
- **并存渐进迁移**：Java 后端与现有 Next.js 共存，按模块逐个迁移，每迁一个模块前端就切到 Java，未迁的仍走 Next.js，全程可运行。

## 目录结构
```
word-battle-app/
├── (现有 Next.js 前端，逐步去 server 化)
└── backend-java/                 ← 新建 Java 后端
    ├── pom.xml / build.gradle
    ├── src/main/java/com/wordbattle/
    │   ├── WordBattleApplication.java
    │   ├── config/        (CORS、Security、JPA、Redis 等)
    │   ├── controller/    (REST 接口)
    │   ├── service/       (业务逻辑)
    │   ├── repository/    (Spring Data JPA)
    │   ├── entity/        (JPA 实体，对应 PG 表)
    │   ├── dto/           (请求/响应 DTO)
    │   └── fsrs/          (FSRS 调度算法移植)
    └── src/main/resources/
        └── application.yml
```

## 技术栈
- **Spring Boot 3.x** + Java 21（虚拟线程可选）
- **Spring Data JPA** + PostgreSQL 驱动（复用现有 PG 库，表结构不变）
- **Spring Security** + JWT（替换现有 auth-actions）
- **Redis**（新增）：缓存热点（dictionary、books）、PK 房间状态、限流、验证码
- **可选 WebSocket / Pusher**：PK 实时对战（替代现在的 700ms 轮询，降低 DB 压力）
- **MapStruct**：entity <-> DTO 映射
- **Liquibase / Flyway**：DB 迁移管理（替代 drizzle）

## 要迁移的接口清单（按模块）

### 模块 1：词库 / 课程（学习路径）
Next.js 现状：`db/queries.ts` 的 getBooks/getBookById/getCoursesByBookId/getUnitsByCourseId/getLessonById/getLibraryStats/getDefaultBook/getWordsForWordSearch + `app/api/courses/route.ts` + `app/api/lessons/[id]/route.ts`

Java 接口：
- `GET /api/books` 词书列表（排除隐藏）
- `GET /api/books/{id}` 词书详情
- `GET /api/books/{id}/units` units + lessons + 完成状态
- `GET /api/lessons/{id}` 关卡题目+选项
- `GET /api/library/stats` 首页统计
- `GET /api/word-search/words?bookId=` 找词游戏取词

### 模块 2：闯关进度
Next.js：`actions/learning-progress.ts`（updateChallengeProgress / updateLessonProgress / refillHearts / getUserLearningProgress / updateDailyGoalLessons）

Java 接口：
- `POST /api/progress/challenge` 答题进度
- `POST /api/progress/lesson` 关卡完成
- `GET /api/progress/today` 今日完成数 + 每日目标
- `PUT /api/progress/daily-goal` 设置每日目标

### 模块 3：复习（FSRS）⭐ 核心
Next.js：`actions/card-review.ts` + `actions/review-plan.ts` + `app/api/review/route.ts` + `lib/fsrs/`

Java 接口：
- `GET /api/review/due` 取到期卡片（含 dictionary 富字段 join）
- `POST /api/review/submit` 提交评分 -> FSRS 调度 -> 更新 user_card_progress
- `POST /api/review-plan/add` 加入复习计划
- `POST /api/review-plan/master` 熟记（写 user_mastered_words + 删 user_card_progress）
- `GET /api/review-plan/mastered?words=` 批量查已熟记

FSRS 算法 `lib/fsrs/scheduler.ts` 移植成 Java（核心是 stability/difficulty/due 计算）。

### 模块 4：PK 对战
Next.js：`actions/pk-actions.ts`（创建/加入/开始/提交/离开/结束/查询/排行榜/NPC）+ `app/api/pk/rooms/route.ts`

Java 接口：
- `POST /api/pk/rooms` 创建房间
- `POST /api/pk/rooms/join` 加入
- `POST /api/pk/rooms/{id}/start` 开始
- `POST /api/pk/rooms/{id}/answer` 提交答案
- `GET /api/pk/rooms/{id}` 房间状态
- `GET /api/pk/rooms/{id}/answers` 双方作答（轮询用）
- `POST /api/pk/npc/start` 人机开局
- `POST /api/pk/npc/answer` 人机答题
- `GET /api/pk/leaderboard` 排行榜

**并发优化**：PK 房间状态走 Redis（替代每 700ms 查 DB），减-heartbeat 压力。后期可换 WebSocket。

### 模块 5：用户 / 认证
Next.js：`actions/auth-actions.ts` + `app/api/auth/route.ts`

Java 接口：
- `POST /api/auth/register` 注册
- `POST /api/auth/login` 登录 -> 返回 JWT
- `GET /api/auth/me` 当前用户（JWT 校验）
- `PUT /api/auth/profile` 更新资料

### 模块 6：词数据 enrich（一次性脚本）
Next.js：`scripts/enrich-exam-words.ts`（调 LLM 批量生成例句/短语/辨析）

Java：写成 **Spring Batch / 命令行 Runner**，逻辑相同（调 LLM API + 批量 UPDATE）。或保留 Node 脚本不动（一次性任务，不影响并发）。

## 表结构（不变，复用现有 PG）
全部 22 张表（users / user_stats / user_settings / books / courses / units / lessons / challenges / challenge_options / user_lesson_progress / user_challenge_progress / dictionary / cards / user_card_progress / card_reviews / pk_* / leaderboard / achievements / user_achievements / user_mastered_words）原样保留，JPA 实体一一对应。新增 `daily_goal_lessons` 列已加。

## 前端改造（去 server 化）
逐模块把：
- server component（`async function Page` + `await db...`）-> 客户端组件 + `useEffect` fetch Java
- server action 调用（`import from "@/actions/..."`）-> `fetch("/api-java/...")`
- 删除 `db/queries.ts`、`actions/`、`lib/db.ts` 的前端依赖

前端用 `NEXT_PUBLIC_API_BASE` 环境变量指向 Java 后端（如 `http://localhost:8080`），CORS 在 Java 配置。

## 分阶段迁移顺序（每阶段可独立上线）
1. **阶段 0**：搭 Java 骨架（Spring Boot + JPA + 一张表跑通 + CORS + 健康检查）
2. **阶段 1**：词库/课程模块（最独立、无依赖）—— 前端 `/courses` 切 Java
3. **阶段 2**：闯关进度模块 —— 前端闯关页切 Java
4. **阶段 3**：复习模块（FSRS）—— 前端 `/review` 切 Java
5. **阶段 4**：PK 模块 + Redis —— 前端 `/pk` 切 Java
6. **阶段 5**：用户/认证 —— JWT 接入
7. **阶段 6**：enrich 脚本 + 清理 Next.js 残留 server 代码

每阶段都**先写 Java + 测试通，再切前端**，Next.js 旧代码保留到全部切完再删。

## 高并发要点
- **Redis 缓存**：dictionary（17k 词富字段）、books、课程树结构缓存，避免每次查 DB。
- **连接池**：HikariCP 调优（max-pool-size、minimum-idle）。
- **虚拟线程**（Java 21）：IO 密集接口（复习查询、PK 轮询）开虚拟线程提吞吐。
- **限流**：Spring Security / Redis 限流保护写接口（评分、PK 答题）。
- **PK 实时**：轮询 -> WebSocket（Spring WebSocket 或 Pusher），降低 DB 轮询压力。
- **DB 索引**：复习查询已有索引；PK 轮询可加 (room_id, question_id) 复合索引。
- **读写分离**：后期可加 PG 只读副本，查询走从库。

## 风险与对策
- **FSRS 算法移植**：scheduler.ts 逻辑要 1:1 移植，否则复习调度错乱。对策：先写单测对比 TS/Java 输出一致再切。
- **数据一致性**：迁移期两端并存，同一数据可能被 Next.js 和 Java 都写。对策：每模块切完即下线 Next.js 对应写入路径。
- **认证**：现有是硬编码 TEST_USER_ID。Java 接入 JWT 后，前端要改所有请求带 token。
- **jsonb 字段**：dictionary 的 examples/definitions/collocations 是 jsonb，JPA 用 `@JdbcTypeCode(SqlTypes.JSON)` 或 Hibernate 6 JSON 支持。

## 工作量估算
- 骨架 + 模块 1（词库）：1-2 天
- 模块 2（进度）：0.5 天
- 模块 3（FSRS 复习）：1-2 天（含算法移植 + 单测）
- 模块 4（PK + Redis）：2-3 天
- 模块 5（认证）：0.5-1 天
- 前端切 Java（逐模块）：每个 0.5 天 × 5
- 合计：约 2-3 周（含调试）

## 第一步建议
先做**阶段 0（骨架）+ 阶段 1（词库模块）**，跑通一条端到端（Java 查 PG -> 前端 fetch 显示词书列表），验证技术栈可行，再批量推进。

---

## 实施进度记录

### 2026-07-11：Phase 0（骨架）+ Phase 1 第一个接口 ✅

**环境就绪**
- GitHub 被墙，brew 走不通；改用清华镜像直装
- JDK 21 (Temurin 21.0.11) → `~/tools/jdk-21`
- Maven 3.9.16 → `~/tools/maven`，`~/.m2/settings.xml` 配阿里云 central 镜像
- PATH 写入 `~/.zshrc`

**后端骨架（`backend-java/`）**
- Spring Boot 3.3.5 + Java 21 + Spring Data JPA + PostgreSQL 驱动 + Lombok + Validation
- `application.yml`：端口 8080，连本地 `word_battle`，`ddl-auto=none`（schema 仍由 Drizzle/SQL 管，Hibernate 不动表）
- 统一响应 `ApiResult<T>` `{code, message, data}` + `GlobalExceptionHandler`
- `CorsConfig`：允许 `http://localhost:3000`（credentials、预检 1h）
- 启动 ~2s，`mvn spring-boot:run` 后台常驻

**第一个接口：`GET /api/books`**
- `Book` 实体映射 `books` 表；`BookRepository.findAllVisible(hidden)` 排除 `WQ-L1`（与前端 `HIDDEN_BOOK_SHORT_NAMES` 一致）
- 返回 8 本可见词书，已验证：CORS 预检 200、实际请求带 `Access-Control-Allow-Origin`

**前端接入（渐进式，双保险）**
- 新增 `lib/api-client.ts`：`fetchBooks()` 服务端 fetch Java，统一解 `ApiResult`
- `app/courses/page.tsx`：改"Java 优先 + Drizzle 兜底"，失败自动回退；root 上加 `data-source={java|drizzle}` 便于排查
- 端到端验证：`/courses` 页 `data-source="java"`，8 本书正常渲染

**下一步**：Phase 1 剩余接口（units/lessons/challenges 详情与进度）、Phase 2 闯关进度读写。

### 2026-07-11：Phase 1（词库/课程模块）+ Phase 2（闯关进度）✅

**Phase 1 — 读取接口（全部已接前端，端到端验证）**

| 方法 | 路径 | 说明 | 前端接入 |
|------|------|------|---------|
| GET | /api/books | 词书列表 | courses 列表页 ✓ |
| GET | /api/books/{id} | 词书详情 | （备用） |
| GET | /api/books/{id}/course-tree | 课程树（课程→单元→关卡，含完成状态） | 课程页 ✓ |
| GET | /api/lessons/{id} | 关卡详情（题目+选项+单词卡，已组装） | 闯关页 ✓ |
| GET | /api/users/me/settings | 用户设置（每日目标） | 课程页 ✓ |
| GET | /api/users/me/today-lessons | 今日已完成关卡数 | 课程页 ✓ |
| PUT | /api/users/me/settings/daily-goal | 更新每日目标 | （前端已有 server action，待接） |

**Phase 2 — 进度写入**

| 方法 | 路径 | 说明 | 前端接入 |
|------|------|------|---------|
| POST | /api/progress/challenge | 单题进度（答错扣 1 心） | lesson-quiz ✓ |
| POST | /api/progress/lesson | 关卡进度（完成累加经验/掌握词） | lesson-quiz ✓ |

**关键技术点**
- `CurrentUserResolver`：统一当前用户来源（现读 `app.test-user-id`，接 JWT 后只改这里）
- jsonb 双层编码：dictionary 的 `examples`/`collocations` 存的是 jsonb string（`jsonb_typeof=string`），`definitions`/`forms` 是真正的 jsonb 数组。`JsonbHelper` 统一处理（isTextual 时二次解析），输出与前端 Drizzle 行为一致
- uuid 列：JPA 实体映射为 `java.util.UUID`；原生 SQL 里 `cast(:param as uuid)` 避开 `uuid = varchar` 报错
- schema drift：`user_lesson_progress` 无 `created_at` 列、`user_challenge_progress.id` 实为 serial integer（Drizzle schema 标 uuid）。实体按 DB 实际类型映射
- 渐进式双保险：所有前端读取"Java 优先 + Drizzle 兜底"，写入"Java 优先 + server action 兜底"。Java 挂了不影响功能
- 前端 `lib/api-client.ts` 统一封装 fetch + 解 `ApiResult`

**待办（后续）**
- Phase 3：复习模块（FSRS）— `addWordToReviewPlan`/`masterWord`/复习队列，现仍走 server action
- Phase 4：PK
- Phase 5：JWT 认证（替换 CurrentUserResolver 的测试用户）
- Phase 6：enrich 脚本迁 Java
- daily-goal PUT 前端接入（替换 updateDailyGoalLessons server action）

### 2026-07-11：Phase 3（复习模块 FSRS）✅

**关键发现**：复习页走的是 `/api/review` route 里的**简化版 `calculateFSRS`**（固定乘数 0.1/0.5/1/2 + 固定间隔 1分/10分/1天/3天 + ±20% 扰动），不是 `lib/fsrs/scheduler.ts` 那套完整 FSRS-6。`actions/card-review.ts` 才用完整 scheduler，但复习页不用。所以移植的是简化版，保证与现有数据一致。

**后端接口（全部 curl 验证）**

| 方法 | 路径 | 说明 | 前端接入 |
|------|------|------|---------|
| GET | /api/review | 复习队列（到期 + 全新补足，限 20，排除隐藏词库） | 复习页 ✓ |
| POST | /api/review | 提交评分（FSRS 简化调度，返回 nextReview/interval） | 复习页 ✓ |
| POST | /api/review/add-word | 加入复习计划（闯关答错/手动，mode: wrong/manual） | lesson-quiz ✓ |
| POST | /api/review/master | 标记熟记（写熟悉列表 + 移出复习计划） | lesson-quiz ✓ |

**验证结果**
- 队列：20 张（6 到期 + 14 全新），card 富字段完整解析（examples/definitions/collocations/discrimination）
- 评分：rating=2 -> state learning→review、stability 0.1、difficulty 1.2→1.1、due 推迟 1 天（带扰动）、reviews+1、correct+1
- add-word：reactivated 时 lapses+1；added 时新建进度行
- master：写 user_mastered_words + 删 user_card_progress（幂等）

**前端接入**
- 复习页（client）：`fetchReviewQueue`/`submitReviewRating` 走 Java，失败回退 Next route `/api/review`；progress.fsrsDueDate 字符串转 Date
- lesson-quiz：`addWordToReviewPlanJava`/`masterWordJava` 走 Java，失败回退 server action
- `api-client.ts` base url 改 `NEXT_PUBLIC_JAVA_API_URL`（client 可见）

**剩余待办**
- Phase 4：PK
- Phase 5：JWT 认证（替换 CurrentUserResolver 测试用户）
- Phase 6：enrich 脚本迁 Java
- daily-goal PUT 前端接入（替换 updateDailyGoalLessons server action）

### 2026-07-11：Phase 4（PK 实时对战）✅

**架构判断**：PK 用 server actions + 轮询（getPKRoom/getRoomAnswers），**无 WebSocket/Pusher**。userId 来自浏览器 localStorage（动态），不依赖 CurrentUserResolver。所以 PK 端点都接收 userId 参数（为 Phase 5 JWT 预留）。

**后端接口（全部 curl 验证）**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/pk/rooms | 创建好友/随机房间 |
| POST | /api/pk/rooms/join | 加入房间 |
| POST | /api/pk/rooms/start | 房主开始对战（返回题目） |
| POST | /api/pk/answers | 真人提交答案 |
| POST | /api/pk/npc/start | NPC 对战开局（建房+题目+NPC） |
| POST | /api/pk/npc/answer | NPC 提交（含 NPC 模拟答题） |
| POST | /api/pk/rooms/{id}/end | 结束游戏（结算 Elo） |
| GET | /api/pk/rooms/{id} | 房间详情（玩家+题目） |
| GET | /api/pk/rooms/{id}/answers | 答题记录（轮询） |

**验证**
- NPC 全流程：开局(3题) -> 答题(用户75分/NPC 73分同步模拟) -> 答案落库(双方) -> 结束
- 好友全流程：create(waiting) -> join(ready) -> start(playing) -> 双方答题 -> 答案落库
- 题目生成：随机取词 + 干扰项 + options 双层编码 jsonb（与 Drizzle 一致）
- Elo 结算：K=32，胜负更新 powerWordRank + gamesPlayed/won

**关键技术点**
- `pk_room_questions.options` jsonb 列：实体映射 String + insertable=false，写入用原生 SQL `cast(:json as jsonb)`（避开 varchar/jsonb 类型错）；存储格式双层编码字符串，与 Drizzle 落库一致
- `findCandidates` 用 Object[] 投影（非接口投影），避免 Hibernate 别名映射不确定性
- `PkUserEnsure`：PK 的动态 userId 需幂等创建 users + user_stats（FK），进程内缓存
- `PkUtils`：1:1 移植 generateRoomCode/shuffleArray/calculatePKScore/shortDef/calculatePowerWordRank
- NPC 模拟：75% 正确率、1.5-3.5s 延迟、同步写答案到 pk_user_answers

**前端接入**
- PK 页（client）：10 个调用点全部改 Java 优先 + server action 兜底
- api-client 加 10 个 PK helper（pkCreateRoom/pkJoinRoom/pkStartGame/pkSubmitAnswer/pkStartNpc/pkSubmitNpcAnswer/pkEndGame/pkGetRoom/pkGetRoomAnswers）

**剩余待办**
- Phase 5：JWT 认证（替换 CurrentUserResolver 测试用户 + PK 的 userId 传参改为从 token 取）
- Phase 6：enrich 脚本迁 Java
- daily-goal PUT 前端接入

### 2026-07-11：剩余页面接入 ✅（前端完全走 Java）

补齐最后几个 Drizzle 直查页面：

| 方法 | 路径 | 说明 | 前端接入 |
|------|------|------|---------|
| GET | /api/books/default | 默认词书（首页"开始学习"用） | 首页 ✓ |
| GET | /api/books/library/stats | 总词数/总关卡/词库数 | 首页 ✓ |
| GET | /api/word-search/words | 找词游戏取词（3-7字母带中文，随机8个） | word-search ✓ |
| PUT | /api/users/me/settings/daily-goal | （已有）每日目标 | daily-plan ✓ |

**验证**：首页 footer 显示 4,273 关/8 词库（Java）；word-search 8 词；daily-plan 渲染 `/ 12 关`（Java 读）+ PUT 改 7 持久化；9 个页面全 200，无 Java 兜底告警。

**前端迁移完成度**：所有页面已走 Java（Java 优先 + Drizzle/server-action 兜底）。Drizzle、server actions、6 个 Next API routes 仍保留作兜底，待 Phase 5 后清理。

**剩余**
- Phase 5：JWT 认证
- Phase 6：enrich 脚本迁 Java
- 清理兜底（删 Drizzle 直查/server actions/旧 API routes）

### 2026-07-11：Phase 5（JWT 认证）✅

**后端**
- `auth` 包：`User` 实体 + `UserRepository` + `JwtUtil`（HS512，30天，与前端 jsonwebtoken 对齐）+ `AuthService`（bcrypt + JWT）+ `AuthController`
- 端点：
  - `POST /api/auth/register` 注册（建 user + user_stats + user_settings + 签 JWT）
  - `POST /api/auth/login` 登录（验 bcrypt + 签 JWT）
  - `GET /api/auth/me` 验 token 返回用户信息
- `CurrentUserResolver` 改造：优先从 `Authorization: Bearer <token>` 头解析 JWT 取 userId，未登录/无 token 回退测试用户（兼容未登录浏览）
- pom 加 `org.mindrot:jbcrypt` + `io.jsonwebtoken:jjwt`
- `application.yml` 加 `app.jwt.secret`/`app.jwt.expiration-days`（可被 `JWT_SECRET` env 覆盖）

**前端**
- `lib/api-client.ts` `apiFetch` 客户端自动从 localStorage 读 token 加 `Authorization` 头；加 `authRegisterJava`/`authLoginJava`/`authMeJava`
- `/api/auth` route 走 Java 优先 + server action 兜底（GET 转发 token）
- `app/profile/page.tsx` 改 client：读 token 调 `/api/auth` 显示真实用户 + 退出登录
- `.env.local` 加 `NEXT_PUBLIC_JAVA_API_URL=http://localhost:8080`

**验证**：注册拿 token -> me 带 token 返回用户 -> 登录拿 token -> 错误密码拒绝 -> CurrentUserResolver 从 token 取 userId（带 token 调 settings 返回新用户 id 而非测试用户）

**剩余**
- Phase 6：enrich 脚本迁 Java
- 清理兜底（删 Drizzle 直查/server actions/旧 API routes）

### 2026-07-13：Phase 6（enrich 脚本迁 Java）✅

**后端**
- `enrich` 包：`DictionaryEnrich` 投影 + `EnrichRepository`（查待 enrich 词 + 原生 SQL 写回）+ `LlmClient`（Java 11 HttpClient 调 OpenAI 兼容 /chat/completions）+ `EnrichService`（buildPrompt/extractJsonArray/validate/processBatch/runPool）+ `EnrichRunner`（CommandLineRunner 触发）
- pom 无需额外依赖（HttpClient/Jackson 自带）
- yml 加 `app.llm.base-url/api-key/model`（可被 `LLM_*` env 覆盖）

**触发方式**
```bash
cd backend-java
export LLM_BASE_URL=... LLM_API_KEY=... LLM_MODEL=glm-5.2
mvn spring-boot:run -Dspring-boot.run.arguments="--enrich --book CET4 --batch 50"
# 选项：--limit N / --concurrency N / --dry-run
```
不传 `--enrich` 时正常启动 Web 服务（CommandLineRunner 直接返回）。

**1:1 复刻点**
- batch=50 默认，concurrency=3，每批后 200ms 延迟
- prompt 模板、temperature=0.3、thinking disabled、max_tokens=16384
- extractJsonArray（去 ```json 代码块、抠 [..]）
- validateResult（校验非空、过滤空 phrase/meaning）
- 断点续跑：只查 collocations/examples/discrimination 任一为 NULL 的词

**存储格式对齐（关键）**
- TS Drizzle 写入：examples/collocations 为 jsonb `string`（双层编码，原文 `"[{\"text\":...}]"`）
- Java 写入：用 `to_jsonb(cast(:json as text))` 把 JSON 字符串整体当 jsonb string 存（与 TS 一致）
- 注：`cast(:json as jsonb)` 会解析成真 jsonb array（不一致）；`:name::text` 会被 Hibernate 误解析参数名，必须用 `cast(... as text)`

**验证**
- dry-run：CET4 待生成 0 词（已全部完成），prompt 预览正常
- 真实跑 TOEFL 3 词（burnish/buzzer/byword）：13s，成功 3 失败 0
- DB 验证：jsonb_typeof=string，原文双层编码与 abandon 等 TS 历史数据一致

**全部 Phase 完成。** 剩余可选：清理兜底（删 Drizzle 直查/server actions/旧 API routes）。
