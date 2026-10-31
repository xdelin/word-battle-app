# Word Battle · 单词闯关学习平台

融合**闯关学习**、**FSRS 间隔重复复习**、**单词 PK 对战**的英语学习应用。
前端 Next.js，后端 Spring Boot（Java），数据库 PostgreSQL + Redis。

## 界面预览

| 首页 | 词书选择 |
| --- | --- |
| ![首页](docs/screenshots/01-home.png) | ![词书选择](docs/screenshots/02-courses.png) |
| **课程关卡** | **FSRS 复习（评分界面）** |
| ![课程关卡](docs/screenshots/03-course-detail.png) | ![复习评分](docs/screenshots/07-review-rating.png) |
| **PK 大厅（词力榜）** | **复习卡片** |
| ![PK 大厅](docs/screenshots/05-pk-lobby.png) | ![复习卡片](docs/screenshots/04-review.png) |
| **个人中心** | |
| ![个人中心](docs/screenshots/06-profile.png) | |

## 核心功能

- **闯关学习**：6 本分级词书（四六级 / 考研 / 托福 / 雅思，共 10,689 词、2,918 关），单元-关卡两级结构，选择 / 听音 / 拼写等题型，生命值 + XP 积分。
- **FSRS 复习调度**：维护 stability / difficulty 双变量与 new → learning → review 状态机，按 4 档评分（忘记 / 困难 / 良好 / 简单）动态计算下次复习时间，到期队列 + 熟记移除。
- **单词 PK 对战**：人机对战、好友房间（房间码邀请）、随机匹配；按词书难度分组卷；速度分 + 正确率计分；错题自动进入复习队列。
- **词力值排行榜**：Elo 积分制，Redis ZSET 实时排名。
- **词库 LLM 富化**：批量调用 LLM 生成例句、搭配、近义辨析等深度内容，自研并发池 + 限速 + 单条失败隔离，结果校验后写回 JSONB。

## 架构

```
浏览器 (Next.js 14 / React 18)
   │  REST (JWT)                    WebSocket /ws/pk（对手作答事件推送）
   ▼                                     ▲
Spring Boot 3.3.5 ────────────────┘
   │            │                │
   ▼            ▼                ▼
PostgreSQL   Redis            LLM API
(JPA/JSONB)  (ZSET 排行榜 /     (词库富化，
             JWT 登出黑名单)    离线批量管线)
```

- **认证**：JWT 无状态认证（jBCrypt 存储密码），登出后将 token 写入 Redis 黑名单主动失效；未登录访问降级为内置演示用户。
- **PK 并发正确性**：加入房间走 `SELECT ... FOR UPDATE` 悲观锁串行化，配合 `(room_id, seat_no)` 部分唯一索引与 `(room_id, user_id)` 唯一约束兜底——锁保证效率，约束保证正确性。
- **实时对战**：提交答案走 HTTP POST 保证幂等落库，事务提交后（`afterCommit`）通过 WebSocket 广播"对手已作答"事件；前端保留 700ms 轮询作为降级，断线 3s 自动重连。
- **复习调度**：FSRS 简化版独立为纯函数类（`FsrsCalculator`），接口稳定、可替换为完整 FSRS-6 实现。
- **演示模式**：不配置后端地址时，前端自动切换为内存 mock 数据，完整流程可脱离数据库运行。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 14（App Router）、React 18、TypeScript、Tailwind CSS、Zustand |
| 后端 | Spring Boot 3.3.5、Spring Data JPA（JSONB）、Bean Validation、jjwt |
| 数据 | PostgreSQL（JSONB 半结构化字段）、Redis（ZSET / String） |
| 实时 | 原生 WebSocket（`TextWebSocketHandler`）+ HTTP 轮询降级 |
| 测试 | JUnit 5 + Mockito，32 个单元测试覆盖 FSRS 调度、PK 组卷/Elo、认证 |
| 部署 | Docker 多阶段构建、docker-compose（PostgreSQL + Redis + 后端 + 前端）、GitHub Actions CI |

## 快速开始

### 方式一：Docker Compose 一键启动

```bash
docker compose up --build
# 前端 http://localhost:3000  后端 http://localhost:8080
```

包含 PostgreSQL 18（自动建表）、Redis 7、Java 后端、Next.js 前端四个服务。
注意：镜像内只初始化了表结构，词库数据需另行导入。

### 方式二：本地开发

前置：JDK 21、Maven、PostgreSQL、Redis。

```bash
# 1. 数据库：创建 word_battle 库，执行 backend-java/docker/postgres-init/01-schema.sql 建表

# 2. 启动后端（默认连接 localhost:5432/word_battle 与 localhost:6379）
cd backend-java
mvn spring-boot:run

# 3. 启动前端
cd word-battle-app
echo 'NEXT_PUBLIC_JAVA_API_URL=http://localhost:8080' > .env.local
npm install
npm run dev
```

### 方式三：纯前端演示模式

不配置 `NEXT_PUBLIC_JAVA_API_URL` 直接 `npm run dev`，前端使用内存 mock 数据，无需后端与数据库。

## 测试

```bash
cd backend-java
mvn test    # 32 个单元测试：FSRS 状态机、组卷/干扰项、Elo 计分、JWT 认证分支
```

## 项目结构

```
word-battle-app/
├── app/                    # Next.js 页面（courses / review / pk / profile）
├── components/             # React 组件
├── lib/                    # api-client、mock-api、工具
├── backend-java/           # Spring Boot 后端
│   └── src/main/java/com/wordbattle/
│       ├── auth/           # JWT 认证 + Redis 黑名单
│       ├── lesson/         # 闯关/词书/课程
│       ├── review/         # FSRS 复习调度
│       ├── pk/             # 对战：房间/组卷/计分/WebSocket/排行榜
│       ├── enrich/         # LLM 词库富化管线
│       ├── user/           # 用户/统计
│       └── common/         # 统一响应/全局异常
├── docker-compose.yml      # PostgreSQL + Redis + 后端 + 前端
└── .github/workflows/      # CI：后端 mvn test（带 PG/Redis 服务）+ 前端 tsc/build
```

## 参考

项目设计与实现过程中参考了以下开源项目：

- [sanidhyy/duolingo-clone](https://github.com/sanidhyy/duolingo-clone)（闯关模式）
- [arleyGuoLei/wechat-app-words-pk](https://github.com/arleyGuoLei/wechat-app-words-pk)（单词对战）
- [open-spaced-repetition/fsrs4anki](https://github.com/open-spaced-repetition/fsrs4anki)（FSRS 算法）
