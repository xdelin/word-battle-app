/**
 * Java 后端 API 客户端（服务端 + 客户端均可调用）。
 *
 * 渐进式迁移期间：调用方应优先用此客户端请求 Java 后端，失败时回退到 Drizzle / server action。
 *
 * 部署模式开关：
 *   - 设了 NEXT_PUBLIC_JAVA_API_URL（如 http://localhost:8080）-> 走 Java 优先 + Drizzle 兜底
 *   - 不设 -> JAVA_ENABLED=false，所有 Java 函数直接抛错，调用方立即回退 Drizzle/server action
 *     （即"前后端不分离"纯 Next.js 模式，部署时不设此变量即可）
 */

const API_BASE = process.env.NEXT_PUBLIC_JAVA_API_URL ?? process.env.JAVA_API_URL ?? "";
export const JAVA_ENABLED = !!API_BASE;
import { mockApiFetch } from "./mock-api";

/** 后端统一响应结构 {@link com.wordbattle.common.ApiResult} */
interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 调 Java 后端。JAVA_ENABLED=false 时直接抛错，调用方 catch 后走 Drizzle 兜底，
 * 不会发起网络请求（避免每次请求都等一次连接失败）。
 *
 * 客户端调用时自动从 localStorage 读 token 并加 Authorization 头（用于 JWT 认证）。
 * 服务端调用无 localStorage，不带 token（走测试用户兜底）。
 */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // 演示模式：未设 NEXT_PUBLIC_JAVA_API_URL 时走 mock，无需 Java 后端/数据库
  if (!JAVA_ENABLED) {
    return mockApiFetch(path, init) as T;
  }
  // 客户端：带 JWT token
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (typeof window !== "undefined" && !headers.Authorization) {
    const token = window.localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
  if (!res.ok) {
    throw new Error(`API ${path} -> HTTP ${res.status}`);
  }
  const json: ApiResult<T> = await res.json();
  if (json.code !== 0) {
    throw new Error(`API ${path} -> code ${json.code}: ${json.message}`);
  }
  return json.data;
}

// ====== DTO（与后端 record 对齐）======

export interface BookDto {
  id: number;
  name: string;
  shortName: string;
  description: string;
  level: string;
  category: string;
  imageUrl: string;
  totalWords: number;
  createdAt: string;
}

// ====== 接口 ======

export async function fetchBooks(): Promise<BookDto[]> {
  return apiFetch<BookDto[]>("/api/books");
}

/** 词书详情。 */
export async function fetchBook(id: number): Promise<BookDto> {
  return apiFetch<BookDto>(`/api/books/${id}`);
}

/** 默认词书（首页"开始学习"用）。 */
export async function fetchDefaultBook(): Promise<BookDto | null> {
  return apiFetch<BookDto | null>("/api/books/default");
}

/** 首页底部统计：总词数、总关卡数、词库数。 */
export async function fetchLibraryStats(): Promise<{ totalWords: number; totalLessons: number; bookCount: number }> {
  return apiFetch<{ totalWords: number; totalLessons: number; bookCount: number }>("/api/books/library/stats");
}

// ====== 课程树 ======

export interface LessonNodeDto {
  id: number;
  title: string;
  description: string | null;
  order: number;
  isBossLesson: boolean;
  totalChallenges: number;
  isCompleted: boolean;
}

export interface UnitNodeDto {
  id: number;
  title: string;
  description: string;
  order: number;
  lessons: LessonNodeDto[];
}

export interface CourseNodeDto {
  id: number;
  title: string;
  description: string;
  order: number;
  units: UnitNodeDto[];
}

export interface CourseTreeDto {
  book: BookDto;
  courses: CourseNodeDto[];
}

/** 整棵课程树（课程 -> 单元 -> 关卡，含当前用户完成状态）。 */
export async function fetchCourseTree(bookId: number): Promise<CourseTreeDto> {
  return apiFetch<CourseTreeDto>(`/api/books/${bookId}/course-tree`);
}

// ====== 用户设置 / 今日进度 ======

export interface UserSettingsDto {
  userId: string;
  dailyGoalLessons: number;
  dailyGoalMinutes: number;
}

export async function fetchUserSettings(): Promise<UserSettingsDto> {
  return apiFetch<UserSettingsDto>("/api/users/me/settings");
}

export async function fetchTodayCompletedLessons(): Promise<number> {
  const res = await apiFetch<{ completedToday: number }>("/api/users/me/today-lessons");
  return res.completedToday;
}

// ====== 关卡详情 ======

export interface OptionDto {
  id: number;
  text: string;
  isCorrect: boolean;
  word?: string | null;           // 该选项对应的英文词
  enDefinition?: string | null;   // 英文释义（切换显示用）
}

export interface ExampleDto {
  text: string;
  translation?: string | null;
  ref?: string | null;
}

export interface DefinitionDto {
  pos: string;
  gloss: string;
}

export interface FormDto {
  form: string;
  tags: string[];
}

export interface CollocationDto {
  phrase: string;
  meaning: string;
}

export interface ConfusableDto {
  word: string;
  meaning: string;
}

export interface CardDto {
  word: string;
  phonetic: string | null;
  translation: string | null;
  example: string | null;
  examples: ExampleDto[] | null;
  audioUrl: string | null;
  tags: string[] | null;
  difficulty: number | null;
  definitions: DefinitionDto[] | null;
  etymology: string | null;
  forms: FormDto[] | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  related: string[] | null;
  frequency: number | null;
  discrimination: string | null;
  collocations: CollocationDto[] | null;
  confusable: ConfusableDto[] | null;
}

export interface QuestionDto {
  id: number;
  challengeId: number;
  type: string;
  question: string;
  options: OptionDto[];
  card: CardDto | null;
}

export interface LessonDetailDto {
  id: number;
  title: string;
  description: string | null;
  questions: QuestionDto[];
}

/** 关卡详情（题目 + 选项 + 单词卡已组装）。 */
export async function fetchLessonDetail(lessonId: number): Promise<LessonDetailDto> {
  return apiFetch<LessonDetailDto>(`/api/lessons/${lessonId}`);
}

// ====== 进度写入（客户端可直接调用）======

export interface ChallengeProgressRequest {
  challengeId: number;
  isCorrect: boolean;
  timeSpent: number;
}

export interface LessonProgressRequest {
  lessonId: number;
  isCompleted: boolean;
  heartsUsed: number;
  xpEarned: number;
}

/** 记录单题答题进度（答错扣 1 心）。失败抛错。 */
export async function postChallengeProgress(req: ChallengeProgressRequest): Promise<void> {
  await apiFetch<void>("/api/progress/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

/** 记录关卡进度（完成则累加经验与掌握词）。失败抛错。 */
export async function postLessonProgress(req: LessonProgressRequest): Promise<void> {
  await apiFetch<void>("/api/progress/lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// ====== 复习模块（客户端可直接调用）======

export interface ReviewCardDto {
  id: string;
  word: string;
  phonetic: string | null;
  translation: string | null;
  example: string | null;
  audioUrl: string | null;
  tags: string[] | null;
  difficulty: number | null;
  definitions: DefinitionDto[] | null;
  examples: ExampleDto[] | null;
  etymology: string | null;
  forms: FormDto[] | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  related: string[] | null;
  frequency: number | null;
  discrimination: string | null;
  collocations: CollocationDto[] | null;
  confusable: ConfusableDto[] | null;
}

export interface ReviewProgressDto {
  fsrsDueDate: string | null;
  totalReviews: number;
  totalCorrect: number;
}

export interface ReviewItemDto {
  card: ReviewCardDto;
  progress: ReviewProgressDto | null;
}

export interface ReviewQueueDto {
  cards: ReviewItemDto[];
  userId: string;
  totalCards: number;
  dueCards: number;
  newCards: number;
}

export interface ReviewRatingResult {
  success: boolean;
  nextReview: string;
  interval: number;
  stability: number;
  difficulty: number;
}

/** 取复习队列（到期 + 全新，限 20）。 */
export async function fetchReviewQueue(): Promise<ReviewQueueDto> {
  return apiFetch<ReviewQueueDto>("/api/review");
}

/** 提交评分。 */
export async function submitReviewRating(cardId: string, rating: number, timeTaken = 1000): Promise<ReviewRatingResult> {
  return apiFetch<ReviewRatingResult>("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId, rating, timeTaken }),
  });
}

/** 加入复习计划。mode: "wrong" | "manual"。返回 status。 */
export async function addWordToReviewPlanJava(word: string, mode: "wrong" | "manual"): Promise<{ status: string; success: boolean }> {
  const res = await apiFetch<{ status: string; success: string }>("/api/review/add-word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, mode }),
  });
  return { status: res.status, success: res.success === "true" };
}

/** 标记单词为已熟记。 */
export async function masterWordJava(word: string): Promise<void> {
  await apiFetch<void>("/api/review/master", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
}

/** 查询哪些词已在当前用户复习计划（结算页预显"已加入"）。 */
export async function fetchWordsInReviewPlan(words: string[]): Promise<{ userId: string; words: string[] }> {
  return apiFetch<{ userId: string; words: string[] }>("/api/review/in-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words }),
  });
}

/** 按词批量查字典富字段（结算页词卡预取，前端 WordCard 直接消费）。 */
export async function fetchWordsDetail(words: string[]): Promise<ReviewCardDto[]> {
  return apiFetch<ReviewCardDto[]>("/api/review/words-detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words }),
  });
}

// ====== PK 模块（客户端可直接调用）======

export interface PkOptionDto {
  text: string;
  enDefinition?: string | null;
}

export interface PkQuestionDto {
  id: string;
  questionIndex: number;
  question: string;
  options: PkOptionDto[];
  correctIndex: number;
  phonetic?: string | null;
}

export interface PkRoomDto {
  id: string;
  roomCode: string;
  type: string;
  status: string;
  bookId: number | null;
  questionCount: number;
  timePerQuestion: number;
  startedAt: string | null;
}

export interface PkRoomUserDto {
  userId: string;
  isHost: boolean;
  totalScore: number;
  correctCount: number;
}

export interface PkRoomDetailDto {
  room: PkRoomDto;
  users: PkRoomUserDto[];
  questions: PkQuestionDto[];
}

export interface PkRoomAnswerDto {
  userId: string;
  questionId: string;
  score: number;
  isCorrect: boolean;
  selectedOption: number | null;
  answeredAt: string | null;
}

export interface SideResultDto {
  isCorrect: boolean;
  score: number;
  timeSpent: number;
}

export interface NpcSubmitResultDto {
  user: SideResultDto;
  npc: SideResultDto;
  correctIndex: number;
}

export interface StartNpcResultDto {
  room: PkRoomDto;
  npcUserId: string;
  npcName: string;
  questions: PkQuestionDto[];
}

export async function pkCreateRoom(params: {
  userId: string; userName?: string; type: string;
  bookId?: number; questionCount?: number; timePerQuestion?: number;
}): Promise<PkRoomDto> {
  return apiFetch<PkRoomDto>("/api/pk/rooms", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function pkJoinRoom(params: {
  userId: string; userName?: string; roomCode: string;
}): Promise<PkRoomDto> {
  return apiFetch<PkRoomDto>("/api/pk/rooms/join", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function pkStartGame(userId: string, roomId: string): Promise<PkQuestionDto[]> {
  return apiFetch<PkQuestionDto[]>("/api/pk/rooms/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, roomId }),
  });
}

export async function pkSubmitAnswer(params: {
  userId: string; roomId: string; questionId: string;
  selectedOption: number; timeSpent: number;
}): Promise<SideResultDto> {
  return apiFetch<SideResultDto>("/api/pk/answers", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function pkStartNpc(params: {
  userId: string; userName?: string; bookId?: number;
  questionCount?: number; timePerQuestion?: number;
}): Promise<StartNpcResultDto> {
  return apiFetch<StartNpcResultDto>("/api/pk/npc/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function pkSubmitNpcAnswer(params: {
  userId: string; roomId: string; questionId: string;
  selectedOption: number; timeSpent: number;
}): Promise<NpcSubmitResultDto> {
  return apiFetch<NpcSubmitResultDto>("/api/pk/npc/answer", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function pkEndGame(roomId: string): Promise<void> {
  await apiFetch<void>(`/api/pk/rooms/${roomId}/end`, {
    method: "POST", headers: { "Content-Type": "application/json" },
  });
}

export async function pkGetRoom(roomId: string): Promise<PkRoomDetailDto> {
  return apiFetch<PkRoomDetailDto>(`/api/pk/rooms/${roomId}`);
}

export async function pkGetRoomAnswers(roomId: string): Promise<PkRoomAnswerDto[]> {
  return apiFetch<PkRoomAnswerDto[]>(`/api/pk/rooms/${roomId}/answers`);
}

export interface PkLeaderboardEntryDto {
  userId: string;
  name: string;
  score: number;
  rank: number;
}

/** 词力值排行榜 Top N（Redis ZSET；Redis 不可用或演示模式返回空列表）。 */
export async function pkGetLeaderboard(limit = 10): Promise<PkLeaderboardEntryDto[]> {
  return apiFetch<PkLeaderboardEntryDto[]>(`/api/pk/leaderboard?limit=${limit}`);
}

// ====== 找词游戏 ======

export interface WordSearchWordDto {
  word: string;
  translation: string;
}

/** 取某词书的找词词条（默认 8 个）。 */
export async function fetchWordSearchWords(bookId: number, limit = 8): Promise<WordSearchWordDto[]> {
  return apiFetch<WordSearchWordDto[]>(`/api/word-search/words?bookId=${bookId}&limit=${limit}`);
}

// ====== 每日目标设置（写入）======

/** 更新每日目标关卡数（1~50）。返回最新设置。 */
export async function updateDailyGoalLessonsJava(goal: number): Promise<UserSettingsDto> {
  return apiFetch<UserSettingsDto>("/api/users/me/settings/daily-goal", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dailyGoalLessons: goal }),
  });
}

export { API_BASE };

/** Java 后端 WebSocket 地址（ws://.../ws/pk）；演示模式返回 null（前端退化为纯轮询）。 */
export function javaWsUrl(): string | null {
  if (!JAVA_ENABLED) return null;
  return `${API_BASE.replace(/^http/, "ws")}/ws/pk`;
}

// ====== 认证（客户端用）======

export interface AuthResultDto {
  success: boolean;
  error: string | null;
  user: { id: string; email: string; name: string; avatarUrl: string | null } | null;
  token: string | null;
}

export async function authRegisterJava(params: { email: string; name: string; password: string }): Promise<AuthResultDto> {
  return apiFetch<AuthResultDto>("/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function authLoginJava(params: { email: string; password: string }): Promise<AuthResultDto> {
  return apiFetch<AuthResultDto>("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function authMeJava(token?: string): Promise<AuthResultDto> {
  return apiFetch<AuthResultDto>("/api/auth/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

/** 登出：通知后端把当前 token 拉黑（Redis 黑名单，TTL=剩余有效期）。失败不阻塞本地登出。 */
export async function authLogoutJava(): Promise<void> {
  try {
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
  } catch {
    // 后端不可用/演示模式：本地登出照常
  }
}

// ====== 背词自习室 ======

export interface StudyRoomDto {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  isPublic: boolean;
  requireApproval: boolean;
  dailyGoal: number;
  memberCount: number;
  createdAt: string;
}

export interface StudyRoomMemberDto {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  joinedAt: string;
  todayNewWords: number;
  todayReviewWords: number;
  streakDays: number;
  totalStudyDays: number;
}

export interface RoomDetailDto {
  room: StudyRoomDto;
  members: StudyRoomMemberDto[];
  currentUserIsAdmin: boolean;
  currentUserId: string;
}

export async function createStudyRoom(params: {
  name: string; isPublic?: boolean; requireApproval?: boolean; dailyGoal?: number;
}): Promise<StudyRoomDto> {
  return apiFetch<StudyRoomDto>("/api/study-rooms", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function fetchStudyRoomPlaza(): Promise<StudyRoomDto[]> {
  return apiFetch<StudyRoomDto[]>("/api/study-rooms/plaza");
}

export async function joinStudyRoom(code: string): Promise<StudyRoomDto> {
  return apiFetch<StudyRoomDto>("/api/study-rooms/join", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function fetchMyStudyRooms(): Promise<StudyRoomDto[]> {
  return apiFetch<StudyRoomDto[]>("/api/study-rooms/mine");
}

export async function fetchStudyRoomDetail(id: string): Promise<RoomDetailDto> {
  return apiFetch<RoomDetailDto>(`/api/study-rooms/${id}`);
}

export async function leaveStudyRoom(id: string): Promise<void> {
  await apiFetch<void>(`/api/study-rooms/${id}/leave`, { method: "DELETE" });
}

/** 更新自习室设置（管理员）。 */
export async function updateStudyRoom(id: string, params: {
  name?: string; isPublic?: boolean; requireApproval?: boolean; dailyGoal?: number;
}): Promise<StudyRoomDto> {
  return apiFetch<StudyRoomDto>(`/api/study-rooms/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export interface StudyRoomApplicationDto {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
}

export async function fetchStudyRoomApplications(id: string): Promise<StudyRoomApplicationDto[]> {
  return apiFetch<StudyRoomApplicationDto[]>(`/api/study-rooms/${id}/applications`);
}

export async function approveStudyRoomApplication(roomId: string, appId: string): Promise<void> {
  await apiFetch<void>(`/api/study-rooms/${roomId}/applications/${appId}/approve`, { method: "POST" });
}

export async function rejectStudyRoomApplication(roomId: string, appId: string): Promise<void> {
  await apiFetch<void>(`/api/study-rooms/${roomId}/applications/${appId}/reject`, { method: "POST" });
}

export interface ReminderDto {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string | null;
  message: string;
  createdAt: string;
}

/** 提醒某成员打卡。 */
export async function remindStudyRoomMember(roomId: string, userId: string): Promise<void> {
  await apiFetch<void>(`/api/study-rooms/${roomId}/members/${userId}/remind`, { method: "POST" });
}

/** 管理员移除成员。 */
export async function kickStudyRoomMember(roomId: string, userId: string): Promise<void> {
  await apiFetch<void>(`/api/study-rooms/${roomId}/members/${userId}`, { method: "DELETE" });
}

/** 我的未读提醒。 */
export async function fetchMyStudyRoomReminders(roomId: string): Promise<ReminderDto[]> {
  return apiFetch<ReminderDto[]>(`/api/study-rooms/${roomId}/reminders`);
}

/** 标记提醒已读。 */
export async function markStudyRoomReminderRead(reminderId: string): Promise<void> {
  await apiFetch<void>(`/api/study-rooms/reminders/${reminderId}/read`, { method: "POST" });
}
