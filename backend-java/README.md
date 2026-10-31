# word-battle-backend (Java)

前后端分离后的 Java 后端。Spring Boot 3 + Java 21 + JPA + PostgreSQL。

## 目录结构

```
src/main/java/com/wordbattle/
├── WordBattleApplication.java   # 启动类
├── config/
│   └── CorsConfig.java          # 跨域（允许 localhost:3000）
├── common/
│   ├── ApiResult.java           # 统一响应封装 {code, message, data}
│   └── GlobalExceptionHandler.java
└── book/                        # 模块1: 词库/课程
    ├── Book.java                # 实体 (books 表)
    ├── BookRepository.java
    ├── BookService.java
    ├── BookController.java      # GET /api/books
    └── dto/BookResponse.java
```

## 运行

```bash
cd word-battle-app/backend-java
mvn spring-boot:run
```

默认端口 8080，连本地 PG `word_battle`（schema 由 Drizzle/SQL 管理，Hibernate ddl-auto=none 不动表）。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/books | 词书列表（不含隐藏词书） |
| GET | /api/books/{id}/course-tree | 课程树（课程->单元->关卡，含完成状态） |
| GET | /api/books/default | 默认词书（首页用） |
| GET | /api/books/library/stats | 总词数/总关卡/词库数 |
| GET | /api/lessons/{id} | 关卡详情（题目+选项+单词卡已组装） |
| GET | /api/users/me/settings | 用户设置（每日目标） |
| GET | /api/users/me/today-lessons | 今日已完成关卡数 |
| PUT | /api/users/me/settings/daily-goal | 更新每日目标 |
| POST | /api/progress/challenge | 单题进度（答错扣 1 心） |
| POST | /api/progress/lesson | 关卡进度（完成累加经验/掌握词） |
| GET | /api/review | 复习队列（到期 + 全新，限 20） |
| POST | /api/review | 提交评分（FSRS 简化调度） |
| POST | /api/review/add-word | 加入复习计划 |
| POST | /api/review/master | 标记单词熟记 |
| GET | /api/word-search/words | 找词游戏取词 |
| POST | /api/pk/rooms | 创建 PK 房间 |
| POST | /api/pk/rooms/join | 加入房间 |
| POST | /api/pk/rooms/start | 房主开始对战 |
| POST | /api/pk/answers | 真人提交答案 |
| POST | /api/pk/npc/start | NPC 对战开局 |
| POST | /api/pk/npc/answer | NPC 提交（含模拟答题） |
| POST | /api/pk/rooms/{id}/end | 结束游戏（结算 Elo） |
| GET | /api/pk/rooms/{id} | 房间详情 |
| GET | /api/pk/rooms/{id}/answers | 答题记录（轮询） |
| POST | /api/auth/register | 注册（bcrypt + JWT） |
| POST | /api/auth/login | 登录 |
| GET | /api/auth/me | 验证 token 返回用户信息 |

### Enrich CLI（离线脚本，非 Web 接口）

```bash
cd backend-java
export LLM_BASE_URL=... LLM_API_KEY=... LLM_MODEL=glm-5.2
mvn spring-boot:run -Dspring-boot.run.arguments="--enrich --book CET4 --batch 50"
# --limit N / --concurrency N / --dry-run
```

## 迁移进度

详见 `../docs/MIGRATION-TO-JAVA.md`。

- [x] Phase 0: 骨架（Spring Boot + JPA + CORS + 统一响应）
- [x] Phase 1: 词库/课程模块（books/course-tree/lesson/settings，已接前端）
- [x] Phase 2: 闯关进度（challenge/lesson 写入，已接前端）
- [x] Phase 3: 复习 (FSRS 简化版) - 队列/评分/加入复习/熟记，已接前端
- [x] Phase 4: PK - NPC/好友/随机匹配，已接前端
- [x] 剩余页面接入（首页/word-search/daily-plan，已接前端）
- [x] Phase 5: 认证 (JWT) - register/login/me + CurrentUserResolver 走 token，已接前端
- [x] Phase 6: enrich 脚本（CommandLineRunner，--enrich 触发）
- [ ] 可选：清理兜底（删 Drizzle 直查/server actions/旧 API routes）
