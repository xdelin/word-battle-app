"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { WordCard, type WordCardData } from "@/components/word-card";
import { postChallengeProgress, postLessonProgress, addWordToReviewPlanJava, masterWordJava } from "@/lib/api-client";

interface LessonOption {
  id: number;
  text: string;
  isCorrect: boolean;
  word?: string | null;
  enDefinition?: string | null;
}

interface LessonQuestion {
  id: number;
  challengeId?: number;
  type: string;
  question: string;
  options: LessonOption[];
  card: WordCardData | null;
}

interface LessonQuizProps {
  bookId: string;
  lessonId: string;
  title: string;
  questions: LessonQuestion[];
}

function getStorageKey(bookId: string) {
  return `word-battle:completed-lessons:${bookId}`;
}

function saveCompletedLesson(bookId: string, lessonId: string) {
  const key = getStorageKey(bookId);
  const storedLessonId = lessonId.startsWith("db-lesson-") ? lessonId : `db-lesson-${lessonId}`;
  const raw = window.localStorage.getItem(key);
  let completed: string[] = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      completed = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      completed = [];
    }
  }

  if (!completed.includes(storedLessonId)) {
    completed.push(storedLessonId);
    window.localStorage.setItem(key, JSON.stringify(completed));
  }
}

type Phase = "quiz" | "card";

export function LessonQuiz({ bookId, lessonId, title, questions }: LessonQuizProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("quiz");
  const [finished, setFinished] = useState(false);
  // 选项中英文切换：Set<option.id> 记录哪些选项显示英文
  const [showEnSet, setShowEnSet] = useState<Set<number>>(new Set());

  // 当前题的"是否已加入复习计划"状态
  const [planState, setPlanState] = useState<"idle" | "adding" | "added" | "failed">("idle");
  // 本关已熟记的词集合（questionIndex → 是否熟记）
  const [masteredSet, setMasteredSet] = useState<Record<number, boolean>>({});

  const question = questions[questionIndex];

  const correctOption = useMemo(
    () => question?.options.find((option) => option.isCorrect),
    [question]
  );
  const isCorrect = selectedAnswer !== null && question?.options[selectedAnswer]?.isCorrect;

  const selectAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null) return;

    setSelectedAnswer(answerIndex);
    const correct = question.options[answerIndex]?.isCorrect ?? false;
    if (correct) setScore((s) => s + 1);

    // 每题答完都自动加入复习计划（不管对错）。
    const word = question.card?.word;
    if (word) {
      setPlanState("adding");
      const mode = correct ? "manual" : "wrong";
      addWordToReviewPlanJava(word, mode)
        .then((r) => setPlanState(r.success ? "added" : "failed"))
        .catch(() => setPlanState("failed"));
    }

    // 进度同步放到后台，不要 await——否则翻词卡会被请求往返卡住
    const challengeId = question.challengeId;
    if (challengeId) {
      postChallengeProgress({
        challengeId,
        isCorrect: correct,
        timeSpent: 3000,
      }).catch((error) => console.error("Failed to sync progress:", error));
    }

  };

  // 标记当前词为已熟记：写入熟悉列表 + 移出复习计划
  const handleMaster = () => {
    const word = question.card?.word;
    if (!word) return;
    setMasteredSet((prev) => ({ ...prev, [questionIndex]: true }));
    masterWordJava(word).catch((e) => {
      console.error("Failed to master word:", e);
      setMasteredSet((prev) => ({ ...prev, [questionIndex]: false }));
    });
  };

  const nextQuestion = async () => {
    if (questionIndex + 1 >= questions.length) {
      saveCompletedLesson(bookId, lessonId);
      setFinished(true);

      try {
        await postLessonProgress({
          lessonId: parseInt(lessonId),
          isCompleted: true,
          heartsUsed: questions.length - score,
          xpEarned: score * 10,
        });
      } catch (error) {
        console.error("Failed to update lesson progress:", error);
      }
      return;
    }

    setQuestionIndex((i) => i + 1);
    setSelectedAnswer(null);
    setPhase("quiz");
    setPlanState("idle");
  };

  const restart = () => {
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setPhase("quiz");
    setPlanState("idle");
    setFinished(false);
  };

  // 空状态
  if (!question) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-[#fafafa] dark:bg-gray-950 px-6">
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-10 text-center">
          <div className="text-5xl mb-4">📚</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">暂无题目</h1>
          <Link
            href={`/courses/${bookId}`}
            className="inline-flex h-11 px-6 items-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
          >
            返回课程
          </Link>
        </div>
      </main>
    );
  }

  // 完成
  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-[#fafafa] dark:bg-gray-950 px-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎊</div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">关卡完成</h1>
            <p className="text-sm text-gray-400">{title}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{questions.length}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">题数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{pct}%</div>
              <div className="text-[11px] text-gray-400 mt-0.5">正确率</div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={restart}
              className="w-full h-12 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
            >
              再做一次
            </button>
            <Link
              href={`/courses/${bookId}`}
              className="w-full h-12 inline-flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:border-gray-300 dark:hover:border-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              返回课程
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 进行中
  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* 顶栏：左上角 退出 + 进度(0/10)，中间标题 */}
      <header className="flex items-center gap-3 px-6 pt-5 pb-3 flex-shrink-0">
        <Link
          href={`/courses/${bookId}`}
          className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
          {questionIndex + 1}/{questions.length}
        </span>
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 text-center">{title}</div>
        <div className="w-12 shrink-0" />
      </header>

      {/* 主体 */}
      <main className="flex-1 px-4 min-h-0 flex flex-col overflow-hidden">
        <div className="w-full max-w-2xl mx-auto py-4 flex-1 flex flex-col min-h-0">
          {phase === "quiz" ? (
            /* -- 答题阶段 -- */
            <div className="flex-1 flex flex-col min-h-0">
              {/* 单词头：只显示单词 + 音标（像复习页一样，不显示题目文字） */}
              <div className="mt-6 px-4">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                  {question.card?.word ?? question.question}
                </h1>
                {question.card?.phonetic && (
                  <div className="mt-2.5 text-sm text-gray-400 dark:text-gray-500 font-light tracking-wide">
                    /{question.card.phonetic}/
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-2 mt-32">
                {question.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrectAns = selectedAnswer !== null && option.isCorrect;
                  const isWrongPick = isSelected && !option.isCorrect;
                  const showEn = !showEnSet.has(option.id);
                  const displayText = showEn && option.enDefinition ? option.enDefinition : option.text;

                  return (
                    <div
                      key={option.id}
                      onClick={() => selectedAnswer === null && selectAnswer(index)}
                      className={`group relative min-h-20 py-3 px-8 rounded-2xl border text-[15px] text-left flex items-center transition-colors cursor-pointer ${
                        isCorrectAns
                          ? "border-gray-900 bg-gray-900 text-white"
                          : isWrongPick
                            ? "border-rose-500 bg-rose-50 text-rose-700"
                            : "border-gray-100 bg-white hover:border-gray-300 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                      } ${selectedAnswer !== null ? "cursor-default" : ""}`}
                    >
                      <span className="flex-1 text-left pointer-events-none">
                        {displayText}
                        {isCorrectAns && <Check className="inline-block shrink-0 w-4 h-4 ml-2" />}
                        {isWrongPick && <X className="inline-block shrink-0 w-4 h-4 ml-2" />}
                      </span>
                      {option.enDefinition && option.text && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEnSet((prev) => {
                              const next = new Set(prev);
                              if (next.has(option.id)) next.delete(option.id);
                              else next.add(option.id);
                              return next;
                            });
                          }}
                          className="absolute right-2 bottom-1 opacity-40 hover:opacity-100 transition-opacity z-10"
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

              {/* 撑开：把按钮推到页面底部 */}
              <div className="flex-1" />

              {/* 底部按钮：下一关 + 看答案（并排，选中选项后显示） */}
              {selectedAnswer !== null && (
                <div className="flex-shrink-0 mt-4 mx-4 flex items-center justify-around">
                  <button
                    onClick={nextQuestion}
                    className="flex flex-col items-center gap-2 py-2 text-gray-900 dark:text-white active:opacity-60 transition-opacity"
                  >
                    <span className="text-[15px] font-medium">下一题</span>
                    <span className="h-1 w-10 rounded-full bg-gray-900 dark:bg-white" />
                  </button>
                  <button
                    onClick={() => setPhase("card")}
                    className="flex flex-col items-center gap-2 py-2 text-gray-900 dark:text-white active:opacity-60 transition-opacity"
                  >
                    <span className="text-[15px] font-medium">看答案</span>
                    <span className="h-1 w-10 rounded-full bg-gray-900 dark:bg-white" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {question.card ? (
                  <WordCard
                    data={question.card}
                    revealed
                    showSpeak
                    mastered={!!masteredSet[questionIndex]}
                    onMaster={handleMaster}
                    className="flex-1 min-h-0"
                  />
                ) : (
                  /* 没找到 card 数据时的降级显示 */
                  <div className="rounded-3xl border border-gray-100 dark:border-gray-800 p-10 text-center">
                    <div className="text-base text-gray-500 dark:text-gray-400">本题暂无词卡数据</div>
                  </div>
                )}
              </div>

              <button
                onClick={nextQuestion}
                className="flex-shrink-0 mt-4 w-full flex flex-col items-center gap-2 py-2 text-gray-900 dark:text-white active:opacity-60 transition-opacity"
              >
                <span className="text-[15px] font-medium">
                  {questionIndex + 1 >= questions.length ? "完成关卡" : "下一题"}
                </span>
                <span className="h-1 w-10 rounded-full bg-gray-900 dark:bg-white" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
