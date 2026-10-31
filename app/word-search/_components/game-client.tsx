"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WordSearchGame } from "./word-search-game";

interface WordEntry {
  word: string;
  translation: string;
}

interface GameClientProps {
  bookId: number;
  bookName: string;
  words: WordEntry[];
}

export function GameClient({ bookId, bookName, words }: GameClientProps) {
  const [done, setDone] = useState<{ ms: number } | null>(null);
  const router = useRouter();

  const handleComplete = useCallback((ms: number) => {
    setDone({ ms });
  }, []);

  const handleRestart = useCallback(() => {
    setDone(null);
    // router.refresh() 会重新执行 server 取词（getWordsForWordSearch 随机），换一组新词
    router.refresh();
  }, [router]);

  if (done) {
    const s = Math.floor(done.ms / 1000);
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">全部找到</h1>
        <p className="text-sm text-gray-400 mb-2">{bookName}</p>
        <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white mb-8">
          {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
        </p>
        <div className="flex flex-col gap-2 max-w-xs mx-auto">
          <button
            onClick={handleRestart}
            className="h-12 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
          >
            再来一局
          </button>
          <Link
            href="/word-search"
            className="h-12 inline-flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          >
            换词书
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">找出全部单词</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">{bookName} · 横向或竖向拖动连接字母</p>
      </div>
      <WordSearchGame words={words} onComplete={handleComplete} onRestart={handleRestart} />
    </div>
  );
}
