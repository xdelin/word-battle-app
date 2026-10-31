/**
 * 集中 mock 层：JAVA_ENABLED=false（未设 NEXT_PUBLIC_JAVA_API_URL）时，
 * apiFetch 路由到这里返回模拟数据，无需 Java 后端/数据库。
 * 复用 lib/mock-data 的现有 mock，补全自习室/auth/词卡等。
 */
import {
  MOCK_BOOKS, MOCK_DEFAULT_BOOK, MOCK_LIBRARY_STATS, MOCK_COURSES,
  MOCK_USER_SETTINGS, MOCK_TODAY_COMPLETED,
  getMockLessonDetail, getMockReviewQueue, getMockReviewResult, getMockWordSearchWords,
  getMockNpcStart, getMockNpcSubmitAnswer, getMockCreateRoom, getMockJoinRoom,
  getMockStartGame, getMockSubmitAnswer, getMockRoom, getMockRoomAnswers,
} from "./mock-data";

// 内存状态（演示用，刷新重置）
let mockStudyRoom: Record<string, unknown> | null = null;
const NOW = () => new Date().toISOString();

export function mockApiFetch(path: string, init?: RequestInit): unknown {
  const method = (init?.method || "GET").toUpperCase();
  let body: Record<string, any> = {};
  if (init?.body) { try { body = JSON.parse(init.body as string); } catch { /* ignore */ } }

  // ===== books =====
  if (path === "/api/books") return MOCK_BOOKS;
  if (path === "/api/books/default") return MOCK_DEFAULT_BOOK;
  if (path === "/api/books/library/stats") return MOCK_LIBRARY_STATS;
  if (/^\/api\/books\/\d+$/.test(path)) {
    const id = Number(path.split("/")[3]);
    return MOCK_BOOKS.find((b: any) => b.id === id) || MOCK_BOOKS[0];
  }
  if (/^\/api\/books\/\d+\/course-tree$/.test(path)) {
    const bookId = Number(path.match(/\/books\/(\d+)\//)?.[1]);
    const course = MOCK_COURSES[bookId] || MOCK_COURSES[Number(Object.keys(MOCK_COURSES)[0])];
    const book = MOCK_BOOKS.find((b: any) => b.id === bookId) || MOCK_BOOKS[0];
    // 与 Java 契约对齐：CourseTreeDto = { book, courses[] }
    return { book, courses: [course] };
  }

  // ===== lessons =====
  if (/^\/api\/lessons\/\d+$/.test(path)) return getMockLessonDetail(Number(path.split("/")[3]));

  // ===== progress =====
  if (path === "/api/progress/challenge" && method === "POST") return null;
  if (path === "/api/progress/lesson" && method === "POST") return null;

  // ===== review =====
  if (path === "/api/review" && method === "GET") return getMockReviewQueue();
  if (path === "/api/review" && method === "POST") return getMockReviewResult(body.rating ?? 3);
  if (path === "/api/review/add-word") return { status: "added", success: "true" };
  if (path === "/api/review/master" && method === "POST") return null;
  if (path === "/api/review/in-plan") return { userId: "mock-user", words: [] as string[] };
  if (path === "/api/review/words-detail") return [];

  // ===== pk =====
  if (path === "/api/pk/npc/start") return getMockNpcStart();
  if (path === "/api/pk/npc/answer") return getMockNpcSubmitAnswer(body.rating ?? 3);
  if (path === "/api/pk/rooms" && method === "POST") return getMockCreateRoom(body.userId || "mock-user");
  if (path === "/api/pk/rooms/join") return getMockJoinRoom();
  if (path === "/api/pk/rooms/start") return getMockStartGame();
  if (path === "/api/pk/answers") return getMockSubmitAnswer(body.rating ?? 3);
  if (/^\/api\/pk\/rooms\/[^/]+\/end$/.test(path)) return null;
  if (/^\/api\/pk\/rooms\/[^/]+$/.test(path) && method === "GET") return getMockRoom();
  if (/^\/api\/pk\/rooms\/[^/]+\/answers$/.test(path)) return getMockRoomAnswers();
  if (path === "/api/pk/leaderboard") {
    return [
      { userId: "mock-1", name: "单词骑士", score: 1587, rank: 1 },
      { userId: "mock-2", name: "爱背单词的猫", score: 1432, rank: 2 },
      { userId: "mock-3", name: "NPC 小词", score: 1389, rank: 3 },
      { userId: "mock-4", name: "半个词法人", score: 1205, rank: 4 },
      { userId: "mock-5", name: "凌晨四点的东京", score: 1102, rank: 5 },
    ];
  }

  // ===== word-search =====
  if (path.startsWith("/api/word-search/words")) return getMockWordSearchWords(body.bookId || 1);

  // ===== auth =====
  if (path === "/api/auth/register" || path === "/api/auth/login") {
    return { success: true, token: "mock-token-" + Date.now(), user: { id: "mock-user", name: body.name || "演示用户", email: body.email || "demo@test.com" } };
  }
  if (path === "/api/auth/me") {
    return { success: true, token: "mock-token", user: { id: "mock-user", name: "演示用户", email: "demo@test.com" } };
  }
  if (path === "/api/auth/logout") return null;

  // ===== users =====
  if (path === "/api/users/me/settings") return MOCK_USER_SETTINGS;
  if (path === "/api/users/me/today-lessons") return { completedToday: MOCK_TODAY_COMPLETED };
  if (path === "/api/users/me/settings/daily-goal" && method === "POST") return MOCK_USER_SETTINGS;

  // ===== study-room =====
  if (path === "/api/study-rooms" && method === "POST") {
    mockStudyRoom = {
      id: "mock-room-" + Date.now(), name: body.name || "我的自习室", code: randomCode(),
      ownerId: "mock-user", isPublic: body.isPublic ?? true, requireApproval: body.requireApproval ?? false,
      dailyGoal: body.dailyGoal || 20, memberCount: 1, createdAt: NOW(),
    };
    return mockStudyRoom;
  }
  if (path === "/api/study-rooms/plaza") {
    return [mockStudyRoom || { id: "plaza-1", name: "四级冲刺自习室", code: "CET4AB", ownerId: "other", isPublic: true, requireApproval: false, dailyGoal: 20, memberCount: 5, createdAt: NOW() }];
  }
  if (path === "/api/study-rooms/join") {
    if (!mockStudyRoom) {
      mockStudyRoom = { id: "joined-1", name: "广场自习室", code: body.code, ownerId: "other", isPublic: true, requireApproval: false, dailyGoal: 15, memberCount: 2, createdAt: NOW() };
    }
    return mockStudyRoom;
  }
  if (path === "/api/study-rooms/mine") return mockStudyRoom ? [mockStudyRoom] : [];
  if (/^\/api\/study-rooms\/reminders\/[^/]+\/read$/.test(path)) return null;
  if (/^\/api\/study-rooms\/[^/]+$/.test(path) && method === "GET") {
    if (!mockStudyRoom) return null;
    return {
      room: mockStudyRoom,
      members: [
        { userId: "mock-user", name: "演示用户", avatarUrl: null, isAdmin: true, joinedAt: NOW(), todayNewWords: 5, todayReviewWords: 8, streakDays: 3, totalStudyDays: 10 },
        { userId: "mock-mate", name: "小伙伴", avatarUrl: null, isAdmin: false, joinedAt: NOW(), todayNewWords: 12, todayReviewWords: 3, streakDays: 7, totalStudyDays: 21 },
      ],
      currentUserIsAdmin: true, currentUserId: "mock-user",
    };
  }
  if (/^\/api\/study-rooms\/[^/]+$/.test(path) && method === "PATCH") {
    if (mockStudyRoom) Object.assign(mockStudyRoom, body);
    return mockStudyRoom;
  }
  if (/^\/api\/study-rooms\/[^/]+\/leave$/.test(path)) { mockStudyRoom = null; return null; }
  if (/^\/api\/study-rooms\/[^/]+\/applications$/.test(path)) return [];
  if (/^\/api\/study-rooms\/[^/]+\/applications\/[^/]+\/(approve|reject)$/.test(path)) return null;
  if (/^\/api\/study-rooms\/[^/]+\/members\/[^/]+\/remind$/.test(path)) return null;
  if (/^\/api\/study-rooms\/[^/]+\/members\/[^/]+$/.test(path) && method === "DELETE") return null;
  if (/^\/api\/study-rooms\/[^/]+\/reminders$/.test(path)) return [] as unknown[];

  console.warn("[mock] unhandled:", method, path);
  return null;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
