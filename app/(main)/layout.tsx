import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* 导航栏 */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-2">
                <span className="text-2xl">📚</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  单词闯关
                </span>
              </Link>

              <div className="hidden md:flex items-center space-x-6">
                <Link
                  href="/courses"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  闯关学习
                </Link>
                <Link
                  href="/review"
                  className="text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                >
                  智能复习
                </Link>
                <Link
                  href="/pk"
                  className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  单词PK
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center space-x-1">
                  <span>❤️</span>
                  <span>5</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>🏆</span>
                  <span>1200</span>
                </div>
              </div>

              <Link href="/auth">
                <Button size="sm" variant="outline">
                  登录/注册
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main>{children}</main>
    </div>
  );
}