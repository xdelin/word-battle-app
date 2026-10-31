import Link from "next/link";
import { fetchLibraryStats, fetchDefaultBook } from "@/lib/api-client";

export const dynamic = "force-dynamic";

/** 默认词书：只取 id/name 供首页跳转用。 */
async function loadDefaultBook() {
  const b = await fetchDefaultBook();
  return b ? { id: b.id, name: b.name } : null;
}

export default async function Home() {
  const [stats, defaultBook] = await Promise.all([
    fetchLibraryStats(),
    loadDefaultBook(),
  ]);

  return (
    <main className="h-[100dvh] flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-sm font-semibold">
            W
          </div>
          <span className="text-[15px] font-medium tracking-tight">Word</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/courses" className="px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            学习
          </Link>
          <Link href="/review" className="px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            复习
          </Link>
          <Link href="/pk" className="px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            PK
          </Link>
          <Link href="/profile" className="ml-2 px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            我
          </Link>
        </nav>
      </header>

      {/* 主体 */}
      <section className="flex-1 flex flex-col items-center justify-center px-8 min-h-0">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-[clamp(3rem,8vw,6rem)] font-semibold tracking-tight leading-[1.05] text-gray-900 dark:text-white">
            每天<span className="text-gray-300 dark:text-gray-700">·</span>一点
            <br />
            把单词<span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">记住</span>
          </h1>

          <p className="mt-8 text-base md:text-lg text-gray-500 dark:text-gray-400 font-light leading-relaxed max-w-md mx-auto">
            基于 FSRS 间隔重复算法，
            <br className="hidden md:block" />
            在你快要遗忘的那一刻，再见一次。
          </p>

          <div className="mt-12 flex items-center justify-center gap-3">
            {/* 开始学习：直跳当前词库的闯关页 */}
            {defaultBook ? (
              <Link
                href={`/courses/${defaultBook.id}`}
                className="h-12 px-7 inline-flex items-center justify-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[15px] font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
              >
                开始学习
              </Link>
            ) : (
              <Link
                href="/courses"
                className="h-12 px-7 inline-flex items-center justify-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[15px] font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
              >
                浏览课程
              </Link>
            )}
            <Link
              href="/review"
              className="h-12 px-7 inline-flex items-center justify-center rounded-full text-gray-700 dark:text-gray-300 text-[15px] font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              今日复习
            </Link>
          </div>
        </div>
      </section>

      {/* 底部统计（从 DB 实时算） */}
      <footer className="px-8 pb-8 flex items-center justify-center gap-10 text-xs text-gray-400 dark:text-gray-500">
        <span className="tabular-nums">
          <span className="text-gray-700 dark:text-gray-200 font-medium">{stats.totalWords.toLocaleString()}</span> 词
        </span>
        <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
        <span className="tabular-nums">
          <span className="text-gray-700 dark:text-gray-200 font-medium">{stats.totalLessons.toLocaleString()}</span> 关
        </span>
        <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
        <span className="tabular-nums">
          <span className="text-gray-700 dark:text-gray-200 font-medium">{stats.bookCount}</span> 词库
        </span>
      </footer>
    </main>
  );
}
