import Link from "next/link";
import { fetchBooks } from "@/lib/api-client";
import { BookPickLink } from "@/app/_components/book-pick-link";

export const dynamic = "force-dynamic";

interface BookRow {
  id: number | string;
  name: string;
  description: string | null;
  level: string;
  category: string;
  totalWords: number;
}

async function loadBooks(): Promise<BookRow[]> {
  const dtos = await fetchBooks();
  return dtos.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description ?? null,
    level: b.level,
    category: b.category,
    totalWords: b.totalWords,
  }));
}

export default async function CoursesPage() {
  let books: BookRow[] = [];
  try {
    books = await loadBooks();
    books.sort((a, b) => (a.level || "").localeCompare(b.level || ""));
  } catch (error) {
    console.error("Failed to load books:", error);
    books = [];
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-8 py-6 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-sm font-semibold">
            W
          </div>
          <span className="text-[15px] font-medium tracking-tight">Word</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/courses" className="px-3 py-1.5 rounded-full text-gray-900 dark:text-white font-medium">学习</Link>
          <Link href="/review" className="px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">复习</Link>
          <Link href="/pk" className="px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">PK</Link>
          <Link href="/profile" className="ml-2 px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">我</Link>
        </nav>
      </header>

      {/* 主体 */}
      <section className="flex-1 px-8 pb-16 max-w-5xl w-full mx-auto">
        <div className="pt-6 pb-10">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 dark:text-white">
            选择词书
          </h1>
          <p className="mt-3 text-base text-gray-500 dark:text-gray-400 font-light">
            挑一本翻开，每天推进一点。
          </p>
        </div>

        {books.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-16 text-center">
            <div className="text-4xl mb-3">📚</div>
            <h3 className="text-base font-medium text-gray-900 dark:text-white">暂无词书</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">请先导入词库数据。</p>
          </div>
        ) : (
          // 网格更密（3/4/6 列），书更小
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {books.map((book) => (
              <BookPickLink
                key={book.id}
                bookId={book.id}
                className="group block"
              >
                {/* 书封：小尺寸，统一灰白 */}
                <div className="relative aspect-[3/4] rounded-r-md rounded-l-sm overflow-hidden border border-gray-100 dark:border-gray-800 transition-transform group-hover:-translate-y-0.5">
                  {/* 书脊（灰黑细条） */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-900 dark:bg-white" />
                  {/* 封面：统一白底/灰-900 */}
                  <div className="absolute inset-0 bg-white dark:bg-gray-900 pl-2.5 pr-2.5 py-3 flex flex-col">
                    {/* 顶部：级别 */}
                    <span className="text-[9px] font-semibold tracking-wider text-gray-400 dark:text-gray-500">{book.level}</span>

                    {/* 中部：词书名 */}
                    <div className="flex-1 flex items-center pt-1">
                      <h3 className="text-[11px] font-medium leading-tight text-gray-900 dark:text-white line-clamp-3">
                        {book.name}
                      </h3>
                    </div>

                    {/* 底部：词数 */}
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                      {book.totalWords.toLocaleString()} 词
                    </div>
                  </div>
                </div>
              </BookPickLink>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
