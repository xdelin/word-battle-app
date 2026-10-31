"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Bot, User as UserIcon, Users, Shuffle, Copy, ArrowLeft, Grid3x3, BookOpen, ChevronUp } from "lucide-react";
import { WordCard, type WordCardData } from "@/components/word-card";
import {
  pkStartNpc, pkSubmitNpcAnswer, pkEndGame, pkCreateRoom, pkJoinRoom,
  pkStartGame, pkSubmitAnswer, pkGetRoom, pkGetRoomAnswers, fetchBooks,
  addWordToReviewPlanJava, fetchWordsInReviewPlan, fetchWordsDetail,
  pkGetLeaderboard, javaWsUrl,
} from "@/lib/api-client";
import type { BookDto, PkLeaderboardEntryDto } from "@/lib/api-client";

const QUESTION_COUNT = 10;
const TIME_PER_QUESTION_SEC = 10;
const TIME_PER_QUESTION_MS = TIME_PER_QUESTION_SEC * 1000;
const MATCH_FALLBACK_SECS = 8;

type Phase = "lobby" | "waiting" | "playing" | "finished";
type Mode = "npc" | "friend" | "random";

interface PKQuestion {
  id: string;
  questionIndex: number;
  question: string;
  options: { text: string; enDefinition?: string | null }[];
  correctIndex: number;
  phonetic?: string | null;
}

interface RoundResult {
  user: { isCorrect: boolean; score: number };
  npc: { isCorrect: boolean; score: number };
}

interface RoomUser {
  userId: string;
  isHost: boolean;
  totalScore: number;
  correctCount: number;
}

/** 结算页词表的一行：单词 + 中文释义 + 本局是否答对 */
interface AnswerRecord {
  questionId: string;
  word: string;
  meaning: string;
  userIsCorrect: boolean;
}

type ReviewBtnState = "idle" | "adding" | "added" | "failed";

/** 浏览器维度的玩家身份；两个标签页/无痕窗口能扮演两个用户 */
function getOrCreatePlayer(): { id: string; name: string } {
  if (typeof window === "undefined") return { id: "550e8400-e29b-41d4-a716-446655440000", name: "玩家" };
  let id = window.localStorage.getItem("word-battle:player-id");
  let name = window.localStorage.getItem("word-battle:player-name");
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem("word-battle:player-id", id);
  }
  if (!name) {
    name = `玩家-${id.slice(0, 4)}`;
    window.localStorage.setItem("word-battle:player-name", name);
  }
  return { id, name };
}

export default function PKPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<{ id: string; name: string }>({
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "玩家",
  });
  useEffect(() => {
    setPlayer(getOrCreatePlayer());
  }, []);

  // 词书选择（全局，存 localStorage，所有 PK 模式 + 找词游戏共用）
  const [books, setBooks] = useState<BookDto[]>([]);
  const [pkBookId, setPkBookId] = useState<number | null>(null);
  const [showBookPicker, setShowBookPicker] = useState(false);
  useEffect(() => {
    fetchBooks().then((list) => {
      setBooks(list);
      const saved = typeof window !== "undefined" ? window.localStorage.getItem("word-battle:pk-book-id") : null;
      if (saved) {
        setPkBookId(Number(saved));
      } else if (list.length > 0) {
        // 未选过词书时，默认选 CET4
        const cet4 = list.find((b) => b.shortName === "CET4") ?? list[0];
        setPkBookId(cet4.id);
      }
    }).catch(() => {});
  }, []);
  const pkBook = books.find((b) => b.id === pkBookId) ?? null;

  // 词力榜（Redis ZSET Top 10；取不到则整块隐藏）
  const [leaderboard, setLeaderboard] = useState<PkLeaderboardEntryDto[]>([]);
  useEffect(() => {
    pkGetLeaderboard(10)
      .then((list) => setLeaderboard(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);
  const pickBook = (id: number) => {
    setPkBookId(id);
    if (typeof window !== "undefined") window.localStorage.setItem("word-battle:pk-book-id", String(id));
    setShowBookPicker(false);
  };

  const [phase, setPhase] = useState<Phase>("lobby");
  const [mode, setMode] = useState<Mode>("npc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);

  const [npcName, setNpcName] = useState("NPC 小词");
  const [questions, setQuestions] = useState<PKQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);

  const [selected, setSelected] = useState<number | null>(null);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [revealCorrect, setRevealCorrect] = useState<number | null>(null);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  // 选项中/英文释义切换：记录哪些 index 显示英文（与学习页同构）
  const [enIdx, setEnIdx] = useState<Set<number>>(new Set());
  // 答对/错全屏闪现提示
  const [flash, setFlash] = useState<{ correct: boolean } | null>(null);

  // 大厅弹窗
  const [friendModal, setFriendModal] = useState<null | { tab: "create" | "join" }>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchSeconds, setMatchSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  // 倒计时（实际 100ms tick 拆到 <CountdownBar /> 子组件，这里只保留答题用时起点）
  const startedAtRef = useRef<number>(0);

  // 累计分数
  const [userScore, setUserScore] = useState(0);
  const [npcScore, setNpcScore] = useState(0); // 对手分（NPC 或真人）
  const [userCorrect, setUserCorrect] = useState(0);
  const [npcCorrect, setNpcCorrect] = useState(0);

  // 结算页词表：每题作答结果（单词 + 释义 + 对错），round 揭晓时累积
  const [answerRecords, setAnswerRecords] = useState<AnswerRecord[]>([]);
  // 每个单词的"加入复习"按钮状态，按 questionId 索引
  const [reviewBtn, setReviewBtn] = useState<Record<string, ReviewBtnState>>({});
  // 结算页词卡抽屉：当前点开的 questionId（null=关闭）；富字段缓存 word -> WordCardData
  const [drawerQid, setDrawerQid] = useState<string | null>(null);
  // 滑入滑出动画：rendered 控制 DOM 存在，slidIn 控制 transform（打开下一帧滑入，关闭滑出后卸载）
  const [drawerRendered, setDrawerRendered] = useState(false);
  const [drawerSlidIn, setDrawerSlidIn] = useState(false);
  const [wordDetailMap, setWordDetailMap] = useState<Record<string, WordCardData>>({});

  const matchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  // 好友对战：轮询函数的最新引用（WS 收到推送时立即执行一次，不等下个 tick）
  const pollNowRef = useRef<(() => void) | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // NPC 主动答题定时器（前端模拟：随机延时后显示"NPC 已作答"）
  const npcTimerRef = useRef<NodeJS.Timeout | null>(null);
  // NPC 模式：用户已答但 NPC 未"作答"时，暂存 NPC 结果，等 NPC 作答后再揭晓
  const npcPendingRef = useRef<{ user: { isCorrect: boolean; score: number }; npc: { isCorrect: boolean; score: number }; correctIndex: number } | null>(null);
  // opponentAnswered 的 ref 镜像：handleAnswer 是 async，await 期间若 NPC 已"作答"，
  // 闭包里的 opponentAnswered 会过期，需用 ref 读取最新值以决定是否立即完成本轮。
  const opponentAnsweredRef = useRef(false);

  // ---- 公共 reset ----
  const resetGameState = () => {
    setQIdx(0);
    setSelected(null);
    setRound(null);
    setRevealCorrect(null);
    setOpponentAnswered(false);
    setEnIdx(new Set());
    setUserScore(0);
    setNpcScore(0);
    setUserCorrect(0);
    setNpcCorrect(0);
    setAnswerRecords([]);
    setReviewBtn({});
    setDrawerQid(null);
    setDrawerRendered(false);
    setDrawerSlidIn(false);
    setWordDetailMap({});
    npcPendingRef.current = null;
  };

  // ---- 人机 ----
  const startNpc = async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await pkStartNpc({
        userId: player.id, userName: player.name,
        bookId: pkBookId ?? undefined,
        questionCount: QUESTION_COUNT, timePerQuestion: TIME_PER_QUESTION_SEC,
      });
      setMode("npc");
      setRoomId(j.room.id);
      setRoomCode(j.room.roomCode);
      setNpcName(j.npcName ?? "NPC 小词");
      setQuestions(j.questions.map((q) => ({ id: q.id, questionIndex: q.questionIndex, question: q.question, options: q.options, correctIndex: q.correctIndex, phonetic: q.phonetic })));
      resetGameState();
      setPhase("playing");
    } catch (e) {
      setError("网络错误");
    } finally {
      setLoading(false);
      setMatching(false);
    }
  };

  // ---- 随机匹配（8s 后降级 NPC）----
  const startRandomMatch = () => {
    setError(null);
    setMatching(true);
    setMatchSeconds(0);
    matchTimerRef.current = setInterval(() => {
      setMatchSeconds((s) => {
        const next = s + 1;
        if (next >= MATCH_FALLBACK_SECS) {
          if (matchTimerRef.current) clearInterval(matchTimerRef.current);
          startNpc();
        }
        return next;
      });
    }, 1000);
  };
  const cancelMatching = () => {
    if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    setMatching(false);
    setMatchSeconds(0);
  };

  // ---- 好友对战：创建 ----
  const createFriendRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await pkCreateRoom({ userId: player.id, userName: player.name, type: "friend", bookId: pkBookId ?? undefined, questionCount: QUESTION_COUNT, timePerQuestion: TIME_PER_QUESTION_SEC });
      setMode("friend");
      setRoomId(j.id);
      setRoomCode(j.roomCode);
      setIsHost(true);
      setRoomUsers([{ userId: player.id, isHost: true, totalScore: 0, correctCount: 0 }]);
      resetGameState();
      setFriendModal(null);
      setPhase("waiting");
    } catch (e) {
      setError("创建房间失败");
    } finally {
      setLoading(false);
    }
  };

  // ---- 好友对战：加入 ----
  const joinFriendRoom = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setError("请输入房间码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const j = await pkJoinRoom({ userId: player.id, userName: player.name, roomCode: code });
      setMode("friend");
      setRoomId(j.id);
      setRoomCode(j.roomCode);
      setIsHost(false);
      resetGameState();
      setFriendModal(null);
      setPhase("waiting");
    } catch (e) {
      setError("加入房间失败");
    } finally {
      setLoading(false);
    }
  };

  // ---- 房主开始对战 ----
  const startFriendGame = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const j = await pkStartGame(player.id, roomId);
      setQuestions(j.map((q) => ({ id: q.id, questionIndex: q.questionIndex, question: q.question, options: q.options, correctIndex: q.correctIndex, phonetic: q.phonetic })));
      setPhase("playing");
    } catch (e) {
      setError("开始失败");
    } finally {
      setLoading(false);
    }
  };

  // ---- waiting 阶段轮询：等对手加入；客人等房主开始 ----
  useEffect(() => {
    if (phase !== "waiting" || !roomId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const j = await pkGetRoom(roomId);
        const data = { status: j.room.status, users: j.users, questions: j.questions };
        setRoomUsers(
          data.users.map((u: any) => ({
            userId: u.userId,
            isHost: u.isHost,
            totalScore: u.totalScore,
            correctCount: u.correctCount,
          })),
        );
        // 房间已开始（房主点了开始），客人也跟进
        if (data.status === "playing" && !isHost) {
          const qs = (data.questions || []).map((q: any) => ({
            id: q.id,
            questionIndex: q.questionIndex,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            phonetic: q.phonetic,
          }));
          setQuestions(qs);
          setPhase("playing");
        }
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, roomId, isHost]);

  // ---- 倒计时起点 / 重置对手作答状态 ----
  // 100ms tick 已拆到 <CountdownBar />，避免每帧重渲染整页选项区。
  useEffect(() => {
    if (phase !== "playing" || round !== null || selected !== null) return;
    startedAtRef.current = Date.now();
    setOpponentAnswered(false);
    setEnIdx(new Set()); // 新题重置中/英文切换态
  }, [phase, qIdx, round, selected]);

  // NPC 主动答题：每题开始时随机延时 0.2-6s 后显示"NPC 已作答"。
  // 独立于 selected/round，避免用户答后 cleanup 清掉定时器导致 NPC 永不"作答"。
  useEffect(() => {
    if (phase !== "playing" || mode !== "npc") return;
    if (npcTimerRef.current) clearTimeout(npcTimerRef.current);
    const delay = 200 + Math.random() * 5800; // 0.2-6s
    npcTimerRef.current = setTimeout(() => {
      setOpponentAnswered(true);
    }, delay);
    return () => {
      if (npcTimerRef.current) {
        clearTimeout(npcTimerRef.current);
        npcTimerRef.current = null;
      }
    };
  }, [phase, qIdx, mode]);

  // opponentAnswered 的 ref 镜像：handleAnswer 是 async，await 期间若 NPC 已"作答"，
  // 闭包里的 opponentAnswered 会过期，需用 ref 读取最新值以决定是否立即完成本轮。
  useEffect(() => {
    opponentAnsweredRef.current = opponentAnswered;
  }, [opponentAnswered]);

  // NPC 模式：用户已答（结果已暂存）且 NPC"作答"后，揭晓 NPC 结果并完成本轮。
  // 用户的分在 handleAnswer 里已立即加上，这里只补 NPC 的分并 setRound 触发推进。
  const completeNpcRound = useCallback(() => {
    const r = npcPendingRef.current;
    if (!r) return; // 用户尚未作答（NPC 先答），等用户答完由 handleAnswer 触发
    npcPendingRef.current = null;
    setNpcScore((s) => s + r.npc.score);
    setNpcCorrect((c) => c + (r.npc.isCorrect ? 1 : 0));
    setRound({ user: r.user, npc: r.npc });
  }, []);

  // NPC 模式：NPC"作答"后，若用户已答（有待揭晓结果），则完成本轮
  useEffect(() => {
    if (mode !== "npc" || !opponentAnswered || round !== null) return;
    completeNpcRound();
  }, [opponentAnswered, mode, round, completeNpcRound]);

  // 每轮揭晓时（NPC 与好友模式都在 setRound 后触发）累积一条作答记录，供结算页词表展示。
  // 按 questionId 去重，避免 React 严格模式双调用或重复触发导致重复条目。
  useEffect(() => {
    if (!round) return;
    const q = questions[qIdx];
    if (!q) return;
    const opts = Array.isArray(q.options) ? (q.options as { text: string; enDefinition?: string | null }[]) : [];
    setAnswerRecords((prev) =>
      prev.some((r) => r.questionId === q.id)
        ? prev
        : [...prev, {
            questionId: q.id,
            word: q.question,
            meaning: opts[q.correctIndex]?.text ?? "",
            userIsCorrect: !!round.user.isCorrect,
          }],
    );
  }, [round, qIdx, questions]);

  // 结算页：预查本局哪些词已在复习计划，直接显示"已加入"（避免对已在计划中的词重复点击）。
  useEffect(() => {
    if (phase !== "finished") return;
    const recs = answerRecords;
    if (recs.length === 0) return;
    let cancelled = false;
    (async () => {
      const words = recs.map((r) => r.word);
      try {
        const res = await fetchWordsInReviewPlan(words);
        if (cancelled) return;
        const inPlan = new Set(res.words);
        setReviewBtn((prev) => {
          const next = { ...prev };
          for (const rec of recs) {
            if (inPlan.has(rec.word)) next[rec.questionId] = "added";
          }
          return next;
        });
      } catch (e) {
        console.warn("[pk] in-plan check failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [phase, answerRecords]);

  // 结算页：一次性预取本局全部词的字典富字段（音标/释义/例句/词源等），
  // 供词卡抽屉即时打开，点开任意词即有完整数据。
  useEffect(() => {
    if (phase !== "finished") return;
    const recs = answerRecords;
    if (recs.length === 0) return;
    let cancelled = false;
    (async () => {
      const words = recs.map((r) => r.word);
      try {
        const list = await fetchWordsDetail(words);
        const dtos: WordCardData[] = list.map((d) => ({
          word: d.word,
          phonetic: d.phonetic,
          translation: d.translation,
          example: d.example,
          examples: d.examples,
          audioUrl: d.audioUrl,
          tags: d.tags,
          difficulty: d.difficulty,
          definitions: d.definitions,
          etymology: d.etymology,
          forms: d.forms,
          synonyms: d.synonyms,
          antonyms: d.antonyms,
          related: d.related,
          frequency: d.frequency,
          discrimination: d.discrimination,
          collocations: d.collocations,
          confusable: d.confusable,
        }));
        if (cancelled) return;
        const map: Record<string, WordCardData> = {};
        for (const d of dtos) map[d.word] = d;
        setWordDetailMap((prev) => ({ ...prev, ...map }));
      } catch (e) {
        console.warn("[pk] words-detail failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [phase, answerRecords]);

  // ---- 真人对战的对手作答轮询 ----
  useEffect(() => {
    if (mode === "npc" || phase !== "playing" || !roomId) return;
    const q = questions[qIdx];
    if (!q) return;
    let stopped = false;
    const poll = async () => {
      try {
        const answers = await pkGetRoomAnswers(roomId);
        if (stopped) return;
        // 对手当前题是否已答
        const oppAnswer = answers.find(
          (a) => a.questionId === q.id && a.userId !== player.id,
        );
        if (oppAnswer) setOpponentAnswered(true);

        // 累计分数（不靠本地 setUserScore 加减，权威以 server 为准）
        const ours = answers.filter((a) => a.userId === player.id);
        const opps = answers.filter((a) => a.userId !== player.id);
        setUserScore(ours.reduce((s, a) => s + (a.score ?? 0), 0));
        setNpcScore(opps.reduce((s, a) => s + (a.score ?? 0), 0));
        setUserCorrect(ours.filter((a) => a.isCorrect).length);
        setNpcCorrect(opps.filter((a) => a.isCorrect).length);

        // 双方都答了当前题 → 揭晓
        const ourAnswer = ours.find((a) => a.questionId === q.id);
        if (ourAnswer && oppAnswer && round === null) {
          setRound({
            user: { isCorrect: !!ourAnswer.isCorrect, score: ourAnswer.score ?? 0 },
            npc: { isCorrect: !!oppAnswer.isCorrect, score: oppAnswer.score ?? 0 },
          });
          setRevealCorrect(q.correctIndex);
          setFlash({ correct: !!ourAnswer.isCorrect });
        }
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    pollNowRef.current = poll;
    pollRef.current = setInterval(poll, 700);
    return () => {
      stopped = true;
      pollNowRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, qIdx, roomId, questions]);

  // ---- 好友对战：WebSocket 订阅"对手已作答"推送（收到即拉取；断线 3s 重连；轮询保留作降级）----
  useEffect(() => {
    if (mode === "npc" || phase !== "playing" || !roomId) return;
    const base = javaWsUrl();
    if (!base) return; // 演示模式（无 Java 后端）：纯轮询
    let closed = false;
    let retryTimer: NodeJS.Timeout | null = null;
    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(`${base}?roomId=${roomId}`);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data as string);
          if (m.type === "opponent-answered") pollNowRef.current?.();
        } catch {}
      };
      ws.onclose = () => {
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [mode, phase, roomId]);

  // ---- 答题 ----
  const handleAnswer = useCallback(
    async (optionIndex: number, isTimeout = false) => {
      if (selected !== null || round !== null) return;
      const q = questions[qIdx];
      if (!q || !roomId) return;

      const timeSpent = isTimeout ? TIME_PER_QUESTION_MS : Date.now() - startedAtRef.current;
      setSelected(optionIndex);
      // 确定性幂等键：同一题的任何重试/重发都复用同一个键，后端 Redis Lua 幂等去重
      const requestId = `${player.id}:${roomId}:${q.id}`;

      if (mode === "npc") {
        let reveal: { user: { isCorrect: boolean; score: number }; npc: { isCorrect: boolean; score: number }; correctIndex: number };
        try {
          const j = await pkSubmitNpcAnswer({ userId: player.id, roomId, questionId: q.id, selectedOption: optionIndex, timeSpent, requestId });
          reveal = {
            user: { isCorrect: j.user.isCorrect, score: j.user.score },
            npc: { isCorrect: j.npc.isCorrect, score: j.npc.score },
            correctIndex: j.correctIndex,
          };
        } catch (e) {
          setError("提交失败");
          return;
        }
        // 用户作答：立即揭晓用户结果（不等 NPC）；时间轴继续走，等 NPC"作答"后由 completeNpcRound 揭晓对手
        setRevealCorrect(reveal.correctIndex);
        setFlash({ correct: !!reveal.user.isCorrect });
        setUserScore((s) => s + reveal.user.score);
        setUserCorrect((c) => c + (reveal.user.isCorrect ? 1 : 0));
        npcPendingRef.current = reveal;
        // 若 NPC 已"作答"（含 await 期间刚答完），用 ref 读最新值，立即完成本轮
        if (opponentAnsweredRef.current) completeNpcRound();
      } else {
        // 真人对战：先把自己的答案落库；揭晓由 polling 决定
        try {
          await pkSubmitAnswer({ userId: player.id, roomId, questionId: q.id, selectedOption: optionIndex, timeSpent, requestId });
        } catch (e) {
          setError("提交失败");
        }
      }
    },
    [selected, round, questions, qIdx, roomId, mode, player.id, completeNpcRound],
  );

  // 结算页：把某题的单词加入复习计划。对的按 manual 加、错的按 wrong 加（wrong 会记一次 lapse）。
  const addToReview = async (rec: AnswerRecord) => {
    if (reviewBtn[rec.questionId] === "adding" || reviewBtn[rec.questionId] === "added") return;
    setReviewBtn((m) => ({ ...m, [rec.questionId]: "adding" }));
    const reviewMode: "wrong" | "manual" = rec.userIsCorrect ? "manual" : "wrong";
    try {
      const r = await addWordToReviewPlanJava(rec.word, reviewMode);
      if (!r.success) throw new Error("add-word returned success=false");
      setReviewBtn((m) => ({ ...m, [rec.questionId]: "added" }));
    } catch (e) {
      console.warn("[pk] add-word failed:", e);
      setReviewBtn((m) => ({ ...m, [rec.questionId]: "failed" }));
    }
  };

  // 词卡抽屉：打开（渲染后下一帧滑入；若已渲染则直接滑入）；关闭（先滑出，transition 结束后卸载）
  const openDrawer = (qid: string) => {
    setDrawerQid(qid);
    if (drawerRendered) {
      setDrawerSlidIn(true);
    } else {
      setDrawerRendered(true); // effect 会在下一帧 setDrawerSlidIn(true)
    }
  };
  const closeDrawer = () => {
    setDrawerSlidIn(false); // 触发滑出，面板 onTransitionEnd 后清空状态卸载
  };
  // 渲染后下一帧滑入（只依赖 drawerRendered：首次打开时为 true -> 滑入）
  useEffect(() => {
    if (!drawerRendered) return;
    const raf = requestAnimationFrame(() => setDrawerSlidIn(true));
    return () => cancelAnimationFrame(raf);
  }, [drawerRendered]);

  const nextQuestion = async () => {
    if (qIdx + 1 >= questions.length) {
      if (roomId) {
        try {
          await pkEndGame(roomId);
        } catch (e) {
          console.error(e);
        }
      }
      setPhase("finished");
      return;
    }
    setQIdx((i) => i + 1);
    setSelected(null);
    setRound(null);
    setRevealCorrect(null);
    setOpponentAnswered(false);
    setFlash(null);
  };

  // 双方答完 1.4s 后推进
  useEffect(() => {
    if (!round) return;
    const t = setTimeout(nextQuestion, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const renderHeader = () => (
    <header className="flex items-center justify-between px-8 py-6 flex-shrink-0">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-sm font-semibold">W</div>
        <span className="text-[15px] font-medium tracking-tight">Word</span>
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/courses" className="px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">学习</Link>
        <Link href="/review" className="px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">复习</Link>
        <Link href="/pk" className="px-3 py-1.5 rounded-full text-gray-900 dark:text-white font-medium">PK</Link>
        <Link href="/profile" className="ml-2 px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">我</Link>
      </nav>
    </header>
  );

  // 词书选择弹窗
  const renderBookPicker = () => showBookPicker ? (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-6"
      onClick={() => setShowBookPicker(false)}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">选择词书</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">PK 与找词游戏都会用这本词书</p>
        <div className="space-y-1.5">
          {books.map((b) => (
            <button
              key={b.id}
              onClick={() => pickBook(b.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors text-left ${
                pkBookId === b.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{b.name}</div>
                <div className={`text-[11px] mt-0.5 ${pkBookId === b.id ? "text-gray-300 dark:text-gray-500" : "text-gray-400"}`}>{b.level} · {b.totalWords.toLocaleString()} 词</div>
              </div>
              {pkBookId === b.id && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowBookPicker(false)}
          className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >关闭</button>
      </div>
    </div>
  ) : null;

  // ============ Lobby ============
  if (phase === "lobby") {
    return (
      <main className="min-h-[100dvh] flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {renderHeader()}
        <section className="flex-1 px-8 pb-12 max-w-3xl w-full mx-auto">
          <div className="pt-6 mb-10">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 dark:text-white">单词 PK</h1>
              <button
                onClick={() => setShowBookPicker(true)}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 mt-1 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="选择词书"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[180px] truncate">{pkBook ? pkBook.name : "选择词书"}</span>
              </button>
            </div>
            <p className="mt-3 text-base text-gray-500 font-light">10 题，每题 10 秒。选得越快分数越高。</p>
          </div>

          <div className="space-y-3">
            <LobbyCard
              icon={<Shuffle className="w-6 h-6" />}
              iconBg="bg-sky-500"
              title="随机匹配"
              desc="系统为你匹配在线玩家"
              cta="匹配"
              onClick={startRandomMatch}
              disabled={loading || matching}
            />
            <LobbyCard
              icon={<Users className="w-6 h-6" />}
              iconBg="bg-violet-500"
              title="好友对战"
              desc="创建房间邀请好友，或加入房间码"
              cta="进入"
              onClick={() => setFriendModal({ tab: "create" })}
              disabled={loading || matching}
            />
            <LobbyCard
              icon={<Bot className="w-6 h-6" />}
              iconBg="bg-gray-900"
              title="人机对战"
              desc="和 NPC 小词来一局，零等待"
              cta={loading ? "准备中…" : "开始"}
              onClick={startNpc}
              disabled={loading || matching}
            />
            <LobbyCard
              icon={<Grid3x3 className="w-6 h-6" />}
              iconBg="bg-emerald-500"
              title="找词游戏"
              desc="在字母网格里找出所有单词"
              cta="开始"
              onClick={() => router.push(pkBookId ? `/word-search?book=${pkBookId}` : "/word-search")}
              disabled={loading || matching}
            />
          </div>

          {error && (
            <div className="mt-6 px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 text-sm">{error}</div>
          )}

          {leaderboard.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-400 uppercase tracking-wider">词力榜</div>
                <div className="text-xs text-gray-400">按词力值</div>
              </div>
              <div className="rounded-3xl border border-gray-100 bg-white divide-y divide-gray-50">
                {leaderboard.map((e) => (
                  <div key={e.userId} className="flex items-center gap-3 px-5 py-3">
                    <span className={`w-6 text-center text-sm font-semibold tabular-nums ${e.rank <= 3 ? "text-gray-900" : "text-gray-300"}`}>{e.rank}</span>
                    <span className="flex-1 text-sm text-gray-700 truncate">{e.name}</span>
                    <span className="text-sm font-semibold tabular-nums text-gray-900">{e.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 匹配中 overlay */}
        {matching && (
          <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center px-6">
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-gray-100" />
              <div className="absolute inset-0 rounded-full border-2 border-t-gray-900 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <Shuffle className="absolute inset-0 m-auto w-7 h-7 text-gray-900" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">正在寻找对手</h2>
            <p className="text-sm text-gray-500 mb-1">已等待 <span className="tabular-nums">{matchSeconds}</span> 秒</p>
            <p className="text-xs text-gray-400 mb-8">
              {MATCH_FALLBACK_SECS - matchSeconds > 0
                ? `${MATCH_FALLBACK_SECS - matchSeconds} 秒后自动改为人机对战`
                : "正在切换到人机对战…"}
            </p>
            <button
              onClick={cancelMatching}
              className="h-11 px-6 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
            >取消</button>
          </div>
        )}

        {/* 好友对战 modal */}
        {friendModal && (
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setFriendModal(null)}
          >
            <div
              className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* tab 切换 */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-2xl mb-5">
                <button
                  onClick={() => setFriendModal({ tab: "create" })}
                  className={`h-9 rounded-xl text-sm font-medium transition-colors ${
                    friendModal.tab === "create" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >创建房间</button>
                <button
                  onClick={() => setFriendModal({ tab: "join" })}
                  className={`h-9 rounded-xl text-sm font-medium transition-colors ${
                    friendModal.tab === "join" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >加入房间</button>
              </div>

              {friendModal.tab === "create" ? (
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-6">
                    创建房间后会得到一个房间码，把它发给好友即可。
                  </p>
                  <button
                    onClick={createFriendRoom}
                    disabled={loading}
                    className="w-full h-11 rounded-2xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >{loading ? "创建中…" : "创建房间"}</button>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">房间码</label>
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="例如 A3F9X2"
                    maxLength={8}
                    className="w-full h-11 px-4 mb-4 rounded-xl border border-gray-200 bg-gray-50 text-sm tabular-nums tracking-widest text-center focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
                  />
                  <button
                    onClick={joinFriendRoom}
                    disabled={loading || !joinCodeInput.trim()}
                    className="w-full h-11 rounded-2xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >{loading ? "加入中…" : "加入房间"}</button>
                </div>
              )}

              {error && (
                <div className="mt-4 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>
              )}

              <button
                onClick={() => { setFriendModal(null); setError(null); }}
                className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600"
              >关闭</button>
            </div>
          </div>
        )}
      {renderBookPicker()}
      </main>
    );
  }

  // ============ Waiting（好友房间等待）============
  if (phase === "waiting") {
    const both = roomUsers.length === 2;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    };
    return (
      <main className="min-h-[100dvh] flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {renderHeader()}
        <section className="flex-1 px-8 pb-12 max-w-md w-full mx-auto flex flex-col items-center justify-center">
          <button
            onClick={() => { setPhase("lobby"); setRoomId(null); }}
            className="self-start mb-8 inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">房间码</div>
          <button
            onClick={copy}
            className="group text-5xl font-bold tabular-nums tracking-widest text-gray-900 mb-2 flex items-center gap-3 hover:text-gray-700 transition-colors"
          >
            {roomCode}
            <span className="text-sm text-gray-400 group-hover:text-gray-600">
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
            </span>
          </button>
          <p className="text-sm text-gray-500 mb-10">
            {isHost ? "把房间码发给好友" : "等待房主开始对战"}
          </p>

          <div className="w-full space-y-2 mb-8">
            {roomUsers.map((u) => (
              <div key={u.userId} className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{u.userId === player.id ? "我" : "好友"}</div>
                    <div className="text-xs text-gray-400">{u.isHost ? "房主" : "玩家"}</div>
                  </div>
                </div>
                <div className="text-xs text-emerald-600">在线</div>
              </div>
            ))}
            {roomUsers.length < 2 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-gray-200">
                <div className="h-9 w-9 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300 animate-pulse">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="text-sm text-gray-400">等待加入…</div>
              </div>
            )}
          </div>

          {isHost ? (
            <button
              onClick={startFriendGame}
              disabled={!both || loading}
              className="w-full h-12 rounded-2xl bg-gray-900 text-white text-[15px] font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "准备中…" : both ? "开始对战" : "等对手加入"}
            </button>
          ) : (
            <div className="text-sm text-gray-400">等房主点击开始…</div>
          )}
        </section>
      {renderBookPicker()}
      </main>
    );
  }

  // ============ Playing ============
  if (phase === "playing") {
    const q = questions[qIdx];
    const opts: { text: string; enDefinition?: string | null }[] = Array.isArray(q?.options) ? (q!.options as { text: string; enDefinition?: string | null }[]) : [];
    const opponentLabel = mode === "npc" ? npcName : "对手";
    const oppIcon = mode === "npc" ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />;
    // NPC 模式：用户答完后时间轴继续走，直到本轮（NPC 作答）结束；好友模式：用户答完即停（保持原行为）
    const countdownActive = round === null && (mode === "npc" || selected === null);
    const handleTimeout = () => {
      if (round !== null) return;
      if (selected === null) {
        // 用户未作答（10s 超时）：按超时提交
        handleAnswer(-1, true).catch(console.error);
      }
      if (mode === "npc") {
        // 兜底：确保 NPC"作答"以完成本轮（用户已答但 NPC 迟迟未答时，时间轴到点即结算）
        setOpponentAnswered(true);
      }
    };

    return (
      <main className="fixed inset-0 z-50 overflow-hidden flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <section className="flex-1 px-4 pt-4 pb-12 max-w-2xl w-full mx-auto overflow-y-auto">
          {/* 退出对战（中途退出不结算） */}
          <div className="pt-5 mb-2 flex">
            <button
              onClick={() => {
                // 中途退出：不结算 Elo，直接回大厅（房间留 finished 由后续清理或丢弃）
                resetGameState();
                setRoomId(null);
                setRoomCode("");
                setIsHost(false);
                setRoomUsers([]);
                setPhase("lobby");
              }}
              className="inline-flex items-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>

          {/* 顶部双方比分 */}
          <div className="pt-2 mb-6 flex items-center justify-between">
            <PlayerBadge name="你" icon={<UserIcon className="w-4 h-4" />} score={userScore} correct={userCorrect} />
            <div className="text-xs text-gray-400 tabular-nums">
              第 <span className="text-gray-900 font-semibold">{qIdx + 1}</span> / {questions.length} 题
            </div>
            <PlayerBadge name={opponentLabel} icon={oppIcon} score={npcScore} correct={npcCorrect} right />
          </div>

          {/* 倒计时（tick 隔离在子组件里，避免每 100ms 重渲染整页） */}
          <CountdownBar
            active={countdownActive}
            resetKey={qIdx}
            onTimeout={handleTimeout}
            statusText={
              round
                ? "双方已作答"
                : selected !== null && !opponentAnswered
                  ? "等对手作答…"
                  : opponentAnswered && selected === null
                    ? "对手已作答，轮到你"
                    : ""
            }
            statusTone={round ? "emerald" : opponentAnswered ? "amber" : "default"}
          />

          {/* 题目：单词 + 音标（与学习/复习页词卡头一致，无"选择正确的中文释义"提示） */}
          <div className="text-center mb-10">
            <div className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold tracking-tight text-gray-900 leading-none">
              {q?.question}
            </div>
            {q?.phonetic && (
              <div className="mt-3 text-sm text-gray-400 font-light tracking-wide">/{q.phonetic}/</div>
            )}
          </div>

          {/* 选项：每项可切换中/英文释义（与学习页同构） */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-2">
            {opts.map((option, i) => {
              const isSelected = selected === i;
              const isRight = revealCorrect === i;
              const isWrongPick = selected === i && revealCorrect !== null && revealCorrect !== i;
              const showEn = !enIdx.has(i); // 默认显示英文释义，点击切中文（与学习页同构）
              const displayText = showEn && option.enDefinition ? option.enDefinition : option.text;
              return (
                <div
                  key={i}
                  onClick={() => selected === null && round === null && handleAnswer(i)}
                  className={`group relative min-h-20 py-3 px-8 rounded-2xl border text-[15px] text-left flex items-center transition-colors cursor-pointer ${
                    isRight
                      ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                      : isWrongPick
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : isSelected
                          ? "border-gray-300 bg-gray-50 text-gray-900"
                          : "border-gray-100 bg-white hover:border-gray-300 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-700"
                  } ${selected !== null || round !== null ? "cursor-default" : ""}`}
                >
                  <span className="flex-1 text-left pointer-events-none">
                    {displayText}
                    {isRight && <Check className="inline-block shrink-0 w-4 h-4 ml-2" />}
                    {isWrongPick && <X className="inline-block shrink-0 w-4 h-4 ml-2" />}
                  </span>
                  {option.enDefinition && option.text && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEnIdx((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        });
                      }}
                      disabled={round !== null}
                      className="absolute right-2 bottom-1 opacity-40 hover:opacity-100 transition-opacity disabled:opacity-30"
                      title="切换中/英文释义"
                    >
                      <span className="flex flex-col items-start gap-[2px]">
                        <span className="h-[1.5px] w-3 rounded-full bg-current" />
                        <span className="h-[1.5px] w-2 rounded-full bg-current" />
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {round && (
            <div className="mt-6 flex items-center text-[15px] font-medium">
              <span className={`flex items-center gap-1.5 ${round.user.isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {round.user.isCorrect ? <Check className="w-4 h-4" strokeWidth={3} /> : <X className="w-4 h-4" strokeWidth={3} />}
                你 {round.user.isCorrect ? "+" : ""}{round.user.score}
              </span>
              <span className="flex-1 text-center text-gray-300 dark:text-gray-700">vs</span>
              <span className={`flex items-center gap-1.5 ${round.npc.isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {round.npc.isCorrect ? <Check className="w-4 h-4" strokeWidth={3} /> : <X className="w-4 h-4" strokeWidth={3} />}
                {opponentLabel} {round.npc.isCorrect ? "+" : ""}{round.npc.score}
              </span>
            </div>
          )}
        </section>
      {renderBookPicker()}
      </main>
    );
  }

  // ============ Finished ============
  const userWon = userScore > npcScore;
  const draw = userScore === npcScore;
  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* 左上角固定返回按钮（不随滚动消失） */}
      <button
        onClick={() => { resetGameState(); setPhase("lobby"); setRoomId(null); }}
        className="fixed top-0 left-0 z-40 h-14 w-14 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-label="返回大厅"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <section className="flex-1 overflow-y-auto px-6 pt-16 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-10">
        <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.08)] p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">{draw ? "🤝" : userWon ? "🏆" : "💪"}</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">{draw ? "平局" : userWon ? "你赢了" : "再来一局！"}</h1>
            <p className="text-sm text-gray-400">对战结束</p>
          </div>
          <div className="space-y-2 mb-8">
            <ScoreRow label="你" score={userScore} correct={userCorrect} total={questions.length} highlight={userWon && !draw} />
            <ScoreRow label={mode === "npc" ? npcName : "对手"} score={npcScore} correct={npcCorrect} total={questions.length} highlight={!userWon && !draw} />
          </div>

          {/* 本局单词表：点击单词打开词卡抽屉（抽屉内右上角"加入复习"按钮） */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider">本局单词</div>
              <div className="text-xs text-gray-400 tabular-nums">
                答对 <span className="text-emerald-600 font-medium">{userCorrect}</span> / {answerRecords.length || questions.length}
              </div>
            </div>
            <div className="space-y-1.5">
              {answerRecords.map((rec) => {
                const added = reviewBtn[rec.questionId] === "added";
                return (
                  <button
                    key={rec.questionId}
                    onClick={() => openDrawer(rec.questionId)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{rec.word}</span>
                        {rec.userIsCorrect
                          ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={3} />
                          : <X className="w-3.5 h-3.5 text-rose-500 shrink-0" strokeWidth={3} />}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{rec.meaning || "-"}</div>
                    </div>
                    {added && (
                      <span className="shrink-0 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">已加入</span>
                    )}
                    <ChevronUp className="shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 -rotate-90" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {renderBookPicker()}

      {/* 结算页词卡抽屉：接近全窗的底部弹层，点单词打开，右上角"加入复习"按钮复用 WordCard 槽。
          z-[60] 盖住全局底部 tab bar（z-50），避免收起按钮被遮挡；词卡区与复习页同构（flex-1 min-h-0）。
          drawerRendered 控制 DOM 存在，drawerSlidIn 控制 transform（渲染后下一帧滑入，关闭滑出后卸载）。 */}
      {drawerRendered && (() => {
        const rec = drawerQid ? answerRecords.find((r) => r.questionId === drawerQid) : null;
        // 渲染期间 drawerQid 可能为空（关闭动画播放中），用兜底空 rec 保证面板仍在
        if (!rec) return null;
        const detail = wordDetailMap[rec.word] ?? { word: rec.word, translation: rec.meaning || null };
        const st = reviewBtn[rec.questionId] ?? "idle";
        const added = st === "added";
        const adding = st === "adding";
        return (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center transition-opacity duration-300"
            style={{ opacity: drawerSlidIn ? 1 : 0, backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={closeDrawer}
          >
            <div
              className="w-full max-w-md h-[95dvh] bg-white dark:bg-gray-950 rounded-t-3xl flex flex-col overflow-hidden transition-transform duration-300 ease-out"
              style={{ transform: drawerSlidIn ? "translateY(0)" : "translateY(100%)" }}
              onClick={(e) => e.stopPropagation()}
              onTransitionEnd={(e) => {
                // 面板 transform 滑出结束后，卸载并清空业务态
                if (e.propertyName === "transform" && !drawerSlidIn) {
                  setDrawerRendered(false);
                  setDrawerQid(null);
                }
              }}
            >
              {/* 顶部拖拽指示条 */}
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <span className="h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>
              {/* 词卡区：与复习页同构，WordCard 撑满剩余高度，短语栏位置与复习/学习页一致 */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4">
                <div className="w-full max-w-2xl mx-auto flex-1 min-h-0 flex flex-col overflow-hidden">
                  <WordCard
                    data={detail}
                    revealed
                    mastered={added}
                    onMaster={added || adding ? undefined : () => addToReview(rec)}
                    actionLabel="加入复习"
                    actionActiveLabel="已加入"
                    className="flex-1 min-h-0"
                  />
                  {st === "failed" && (
                    <div className="mt-3 text-center text-xs text-rose-500">加入失败，点右上角「加入复习」重试</div>
                  )}
                </div>
              </div>
              {/* 底部收起卡片按钮（钉底，带安全区留白，不被 tab bar 遮挡） */}
              <div className="flex-shrink-0 px-8 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                <button
                  onClick={closeDrawer}
                  className="w-full h-14 flex flex-col items-center justify-center gap-1 text-gray-900 dark:text-white active:opacity-60"
                >
                  <span className="text-[15px] font-medium">收起卡片</span>
                  <span className="h-1 w-10 rounded-full bg-gray-900 dark:bg-white" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

function LobbyCard({
  icon, iconBg, title, desc, cta, onClick, disabled,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group w-full flex items-center justify-between p-6 rounded-3xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.08)] transition-all disabled:opacity-50 text-left"
    >
      <div className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-2xl ${iconBg} text-white flex items-center justify-center`}>{icon}</div>
        <div>
          <div className="text-base font-semibold text-gray-900">{title}</div>
          <div className="mt-0.5 text-sm text-gray-500">{desc}</div>
        </div>
      </div>
      <span className="text-xs px-3 py-1.5 rounded-full bg-gray-900 text-white group-hover:bg-gray-700 transition-colors">{cta}</span>
    </button>
  );
}

function PlayerBadge({ name, icon, score, correct, right = false }: {
  name: string; icon: React.ReactNode; score: number; correct: number; right?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">{icon}</div>
      <div className={right ? "text-right" : ""}>
        <div className="text-xs text-gray-400">{name}</div>
        <div className="text-base font-semibold tabular-nums">
          {score}
          <span className="ml-1.5 text-[11px] font-normal text-gray-400">· {correct} 对</span>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, score, correct, total, highlight }: {
  label: string; score: number; correct: number; total: number; highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${highlight ? "bg-emerald-50" : "bg-gray-50"}`}>
      <div className="flex flex-col">
        <span className="text-[13px] text-gray-500">{label}</span>
        <span className="text-xs text-gray-400">{correct} / {total} 题</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? "text-emerald-700" : "text-gray-900"}`}>{score}</div>
    </div>
  );
}

/**
 * 倒计时条。把 100ms 的 setState 关在本组件内部，
 * 这样 PK 主组件（选项按钮、比分等）不会每秒被重渲染 10 次。
 * onTimeout 用 ref 持有，避免 handleAnswer 变化导致定时器重启。
 */
function CountdownBar({
  active,
  resetKey,
  onTimeout,
  statusText,
  statusTone,
}: {
  active: boolean;
  resetKey: unknown;
  onTimeout: () => void;
  statusText: string;
  statusTone: "emerald" | "amber" | "default";
}) {
  const [ms, setMs] = useState(TIME_PER_QUESTION_MS);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    firedRef.current = false;
    setMs(TIME_PER_QUESTION_MS);
    const id = setInterval(() => {
      const left = TIME_PER_QUESTION_MS - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(id);
        setMs(0);
        if (!firedRef.current) {
          firedRef.current = true;
          onTimeoutRef.current();
        }
      } else {
        setMs(left);
      }
    }, 100);
    return () => clearInterval(id);
    // 只在题目切换 / active 翻转时重启；onTimeout 经 ref 传入，不入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, active]);

  const toneClass =
    statusTone === "emerald" ? "text-emerald-600 font-medium"
      : statusTone === "amber" ? "text-amber-600"
        : "";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5 tabular-nums">
        <span>{(Math.max(0, ms) / 1000).toFixed(1)}s</span>
        <span className={toneClass}>{statusText}</span>
      </div>
      <div className="h-[3px] w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${ms < 3000 ? "bg-rose-500" : "bg-gray-900"}`}
          style={{ width: `${(Math.max(0, ms) / TIME_PER_QUESTION_MS) * 100}%`, transitionDuration: "100ms" }}
        />
      </div>
    </div>
  );
}
