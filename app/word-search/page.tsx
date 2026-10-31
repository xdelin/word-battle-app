import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchBooks, fetchWordSearchWords, fetchBook } from "@/lib/api-client";
import { GameClient } from "./_components/game-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { book?: string };
}

export default async function WordSearchPage({ searchParams }: PageProps) {
  const books = await fetchBooks();
  // 词书优先级：URL ?book= > 第一本可见词书（不再显示选择网格）
  const urlBookId = searchParams.book ? Number(searchParams.book) : NaN;
  const bookId = !Number.isNaN(urlBookId)
    ? urlBookId
    : (books[0]?.id ?? NaN);
  const hasBook = !Number.isNaN(bookId);

  // 取词
  let book: { id: number; name: string } | null = null;
  let words: { word: string; translation: string }[] = [];
  if (hasBook) {
    [book, words] = await Promise.all([
      fetchBook(bookId).then((b) => ({ id: b.id, name: b.name })),
      fetchWordSearchWords(bookId, 8),
    ]);
  }

  return (
    <main className="fixed inset-0 overflow-hidden flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 px-6 pt-5 pb-3 flex-shrink-0">
        <Link
          href="/pk"
          className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">找词游戏 · {book?.name ?? books.find((b: any) => b.id === bookId)?.name ?? ""}</span>
        <div className="flex-1" />
        <div className="w-12 shrink-0" />
      </header>

      <div className="flex-1 px-4 min-h-0 overflow-y-auto">
        <div className="w-full max-w-xl mx-auto py-6">
          {!hasBook || !book || words.length < 3 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">可用词不足，请先在 PK 页选择词书</p>
              <Link href="/pk" className="inline-flex mt-4 h-10 px-5 items-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm">去选词书</Link>
            </div>
          ) : (
            <GameClient key={bookId} bookId={bookId} bookName={book.name} words={words} />
          )}
        </div>
      </div>
    </main>
  );
}
