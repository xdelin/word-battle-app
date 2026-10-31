"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WordCard } from "@/components/word-card";
import { fetchReviewQueue, submitReviewRating, type ReviewItemDto } from "@/lib/api-client";

interface CardItem {
  card: {
    id: string;
    word: string;
    phonetic: string | null;
    translation: string | null;
    example: string | null;
    audioUrl?: string | null;
    tags?: string[] | null;
    difficulty?: number | null;
    // dictionary 富字段
    definitions?: { pos: string; gloss: string }[] | null;
    examples?: { text: string; translation?: string | null; ref?: string | null }[] | null;
    etymology?: string | null;
    forms?: { form: string; tags: string[] }[] | null;
    synonyms?: string[] | null;
    antonyms?: string[] | null;
    related?: string[] | null;
    frequency?: number | null;
    discrimination?: string | null;
    collocations?: { phrase: string; meaning: string }[] | null;
  };
  progress?: {
    fsrsDueDate: Date | null;
    totalReviews: number;
    totalCorrect: number;
  } | null;
}

export default function ReviewPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const [stats, setStats] = useState({
    reviewed: 0,
    correct: 0,
    totalXP: 0,
  });

  const [session, setSession] = useState({
    startTime: new Date(),
    duration: 0,
  });

  const [isReviewComplete, setIsReviewComplete] = useState(false);
  const [reviewSummary, setReviewSummary] = useState({
    totalCards: 0,
    remembered: 0,
    forgotten: 0,
    totalTime: 0,
    xpEarned: 0,
    nextReviewTime: null as Date | null,
  });

  const [lastReviewResult, setLastReviewResult] = useState<{
    success: boolean;
    message: string;
    nextReview?: Date;
    interval?: number;
  } | null>(null);

  // 乐观翻卡后，POST 在后台跑；用 ref 记录已评分的 cardId，
  // 防止键盘快速连按时 stale closure 把同一张卡重复提交。
  const ratedCardIdsRef = useRef<Set<string>>(new Set());

  const [fsrsExplanation, setFsrsExplanation] = useState<{
    rating: number;
    explanation: string;
    nextReview: string;
  } | null>(null);

  // 加载待复习卡片
  const loadDueCards = async () => {
    setLoading(true);
    try {
      const q = await fetchReviewQueue();
      if (q.cards && q.cards.length > 0) {
        setCards(q.cards.map(mapJavaItem));
        setCurrentIndex(0);
      } else {
        setCards([]);
      }
    } catch (error) {
      console.error("Failed to load cards:", error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  /** Java ReviewItemDto -> 前端 CardItem（progress.fsrsDueDate 字符串转 Date）。 */
  function mapJavaItem(item: ReviewItemDto): CardItem {
    return {
      card: item.card,
      progress: item.progress
        ? {
            fsrsDueDate: item.progress.fsrsDueDate ? new Date(item.progress.fsrsDueDate) : null,
            totalReviews: item.progress.totalReviews,
            totalCorrect: item.progress.totalCorrect,
          }
        : null,
    };
  }

  useEffect(() => {
    loadDueCards();

    // 更新会话时间
    const timer = setInterval(() => {
      setSession(prev => ({
        ...prev,
        duration: Math.floor((Date.now() - prev.startTime.getTime()) / 1000 / 60),
      }));
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // 键盘快捷键：空格显示答案；1-4 对应忘记/困难/良好/简单
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading || isReviewComplete || reviewing) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!showAnswer) handleShowAnswer();
        return;
      }
      if (!showAnswer) return;
      // 1=忘记(0)  2=模糊(2)  3=简单(3)
      const map: Record<string, number> = { "1": 0, "2": 2, "3": 3 };
      const r = map[e.key];
      if (r !== undefined) {
        e.preventDefault();
        handleReview(r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, reviewing, loading, isReviewComplete, currentIndex, cards.length]);

  // 显示答案
  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  // 获取评分说明
  const getRatingExplanation = (rating: number): { explanation: string; emoji: string; nextReview: string } => {
    const explanations = {
      0: {
        explanation: "完全忘记了这个单词，需要重新学习",
        emoji: "😵",
        nextReview: "1分钟后复习",
      },
      1: {
        explanation: "很困难，勉强想起来，需要加强练习",
        emoji: "😕",
        nextReview: "10分钟后复习",
      },
      2: {
        explanation: "印象模糊，需要再加深一遍",
        emoji: "🤔",
        nextReview: "1天后复习",
      },
      3: {
        explanation: "非常轻松地记住了，掌握得很好",
        emoji: "😄",
        nextReview: "3天后复习",
      },
    };
    return explanations[rating as keyof typeof explanations];
  };

  // 处理复习评分
  const handleReview = async (rating: number) => {
    if (reviewing || !showAnswer) return;

    const currentCard = cards[currentIndex];
    if (!currentCard) return;
    // 同一张卡只评分一次（乐观翻卡后 POST 在后台，靠 ref 防重）
    if (ratedCardIdsRef.current.has(currentCard.card.id)) return;
    ratedCardIdsRef.current.add(currentCard.card.id);

    const isCorrect = rating >= 2;
    const isLastCard = currentIndex >= cards.length - 1;
    const ratingInfo = getRatingExplanation(rating);

    // 1) 乐观推进：立刻翻面 + 计数 + 切下一张，不等服务器
    setReviewing(true);
    setShowAnswer(false);
    setStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      totalXP: 0,
    }));

    if (isLastCard) {
      handleReviewComplete();
    } else {
      setCurrentIndex(prev => Math.min(prev + 1, cards.length - 1));
    }
    setReviewing(false);

    // 2) FSRS 落库 + 调度放到后台，不阻塞 UI。
    submitReviewRating(currentCard.card.id, rating, 1000)
      .then((result) => {
        // 评分结果飘一个非阻塞 toast
        setLastReviewResult({
          success: true,
          message: `${ratingInfo.emoji} ${ratingInfo.nextReview}`,
          nextReview: result.nextReview ? new Date(result.nextReview) : undefined,
          interval: result.interval,
        });
        setFsrsExplanation({
          rating,
          explanation: ratingInfo.explanation,
          nextReview: ratingInfo.nextReview,
        });
        // 1.6 秒后自动消失
        setTimeout(() => {
          setLastReviewResult(null);
          setFsrsExplanation(null);
        }, 1600);
      })
      .catch(() => {
        setLastReviewResult({ success: false, message: "网络错误，请重试" });
      });
  };

  // 处理复习完成
  const handleReviewComplete = () => {
    // 用函数式 setter 读到最新统计，避免闭包里拿到旧 stats
    setStats(prevStats => {
      const totalTime = Math.floor((Date.now() - session.startTime.getTime()) / 1000 / 60);
      setReviewSummary({
        totalCards: cards.length,
        remembered: prevStats.correct,
        forgotten: prevStats.reviewed - prevStats.correct,
        totalTime,
        xpEarned: prevStats.totalXP,
        nextReviewTime: new Date(),
      });
      return prevStats;
    });

    setIsReviewComplete(true);
  };

  // 开始新一轮复习
  const handleNewSession = () => {
    setIsReviewComplete(false);
    setStats({ reviewed: 0, correct: 0, totalXP: 0 });
    setCurrentIndex(0);
    setShowAnswer(false);
    ratedCardIdsRef.current = new Set();
    loadDueCards();
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#f8fafc] dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-gray-900 dark:border-gray-800 dark:border-t-white animate-spin" />
          <p className="text-sm text-gray-400">正在准备复习卡片</p>
        </div>
      </div>
    );
  }

  if (cards.length === 0 && !loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-gray-950 px-6">
        <div className="text-7xl mb-6">🎉</div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">今日已无待复习</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 text-center max-w-sm">
          你已经完成全部任务。去闯关再积累一些单词，或稍后回来。
        </p>
        <Button
          onClick={() => (window.location.href = "/courses")}
          className="h-12 px-8 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 rounded-2xl"
        >
          去闯关学习
        </Button>
      </div>
    );
  }

  // 复习完成界面
  if (isReviewComplete) {
    const correctPct = reviewSummary.totalCards > 0
      ? Math.round((reviewSummary.remembered / reviewSummary.totalCards) * 100)
      : 0;
    const grade = correctPct >= 80 ? "优秀" : correctPct >= 60 ? "良好" : "继续努力";
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#f8fafc] dark:bg-gray-950 px-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.08)] p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎊</div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">复习完成</h1>
            <p className="text-sm text-gray-400">本次表现：{grade}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{reviewSummary.totalCards}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">卡片</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{correctPct}%</div>
              <div className="text-[11px] text-gray-400 mt-0.5">正确率</div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleNewSession}
              className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 rounded-2xl"
            >
              再来一轮
            </Button>
            <Button
              onClick={() => (window.location.href = "/courses")}
              variant="outline"
              className="w-full h-12 rounded-2xl border-gray-200 dark:border-gray-800"
            >
              继续闯关学习
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  // 兜底：当卡片列表已耗尽但完成态还未切换（例如 setTimeout 排队中），
  // 直接显示一个加载占位，避免访问 undefined 的字段崩溃
  if (!currentCard) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="text-5xl animate-bounce mb-3">🎉</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">复习结算中…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* 顶栏：左上角 返回 + 进度（模仿闯关页） */}
      <header className="flex items-center gap-3 px-6 pt-5 pb-3 flex-shrink-0">
        <button
          onClick={() => (window.location.href = "/")}
          className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
          {currentIndex + 1}/{cards.length}
        </span>
        <div className="flex-1" />
        <div className="w-12 shrink-0" />
      </header>

      {/* 主体：WordCard + 底部评分按钮（和闯关页布局一致） */}
      <main className="flex-1 px-4 min-h-0 flex flex-col overflow-hidden">
        <div className="w-full max-w-2xl mx-auto py-4 flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <WordCard
              data={currentCard.card}
              revealed={showAnswer}
              className="flex-1 min-h-0"
            />
          </div>

          {/* 评分按钮 / 显示答案按钮（钉底，和闯关"下一题"同款纯文字+底部条） */}
          <div className="flex-shrink-0 mt-4">
            {!showAnswer ? (
              <button
                onClick={handleShowAnswer}
                className="w-full flex flex-col items-center gap-2 py-2 text-gray-900 dark:text-white active:opacity-60 transition-opacity"
              >
                <span className="text-[15px] font-medium">显示释义</span>
                <span className="h-1 w-10 rounded-full bg-gray-900 dark:bg-white" />
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { rating: 0, label: "忘记" },
                  { rating: 2, label: "模糊" },
                  { rating: 3, label: "简单" },
                ].map(opt => (
                  <button
                    key={opt.rating}
                    onClick={() => handleReview(opt.rating)}
                    disabled={reviewing}
                    className="flex flex-col items-center gap-2 py-2 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed active:opacity-60 transition-opacity"
                  >
                    <span className="text-[15px] font-medium">{opt.label}</span>
                    <span className="h-1 w-8 rounded-full bg-gray-900 dark:bg-white" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
