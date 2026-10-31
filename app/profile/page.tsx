"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { authMeJava, authLogoutJava } from "@/lib/api-client";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    authMeJava(token)
      .then((d) => {
        if (d.success && d.user) {
          setUser(d.user);
        } else {
          // token 无效，清掉
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    // 先通知后端拉黑 token（失败不阻塞），再清本地登录态
    await authLogoutJava();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/");
    router.refresh();
  };

  const stats = [
    { value: 0, label: "学习天数" },
    { value: 0, label: "掌握单词" },
    { value: 0, label: "总积分" },
    { value: 0, label: "词力值" },
  ];

  const settings = [
    { label: "学习设置", hint: "每日目标 · 难度偏好" },
    { label: "提醒设置", hint: "复习提醒时间" },
    { label: "PK 设置", hint: "匹配范围 · 题量" },
    { label: "账户设置", hint: "登录 · 同步 · 注销" },
  ];

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#fafafa] text-gray-900">
      <header className="flex items-center justify-between px-8 py-6 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gray-900 flex items-center justify-center text-white text-sm font-semibold">
            W
          </div>
          <span className="text-[15px] font-medium tracking-tight">Word</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/courses" className="px-3 py-1.5 rounded-full text-gray-500 hover:text-gray-900 transition-colors">学习</Link>
          <Link href="/review" className="px-3 py-1.5 rounded-full text-gray-500 hover:text-gray-900 transition-colors">复习</Link>
          <Link href="/pk" className="px-3 py-1.5 rounded-full text-gray-500 hover:text-gray-900 transition-colors">PK</Link>
          <Link href="/profile" className="ml-2 px-3 py-1.5 rounded-full text-gray-900 font-medium">我</Link>
        </nav>
      </header>

      <section className="flex-1 px-8 pb-12 max-w-3xl w-full mx-auto">
        {/* 用户信息 */}
        <div className="pt-6 pb-10 flex items-center gap-5">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-2xl">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              "👤"
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {loading ? "加载中…" : user ? user.name : "未登录"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {user ? user.email : "登录后可同步学习进度"}
            </p>
          </div>
          {user ? (
            <button
              onClick={handleLogout}
              className="h-10 px-5 inline-flex items-center rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              退出登录
            </button>
          ) : (
            <Link
              href="/auth"
              className="h-10 px-5 inline-flex items-center rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              登录
            </Link>
          )}
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {stats.map(s => (
            <div
              key={s.label}
              className="rounded-2xl border border-gray-100 bg-white p-5 text-center"
            >
              <div className="text-3xl font-semibold tabular-nums text-gray-900">{s.value}</div>
              <div className="mt-1 text-[12px] text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 学习统计区 */}
        <div className="rounded-3xl border border-gray-100 bg-white p-6 mb-6">
          <div className="flex items-baseline justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900">学习统计</h3>
            <span className="text-xs text-gray-400">近 7 天</span>
          </div>
          <div className="h-32 flex items-end justify-between gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-gray-100 rounded-md transition-all hover:bg-gray-200"
                  style={{ height: "8px" }}
                />
                <span className="text-[10px] text-gray-300">
                  {["一", "二", "三", "四", "五", "六", "日"][i]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center text-xs text-gray-400">暂无学习数据</div>
        </div>

        {/* 设置 */}
        <div className="rounded-3xl border border-gray-100 bg-white overflow-hidden">
          {settings.map((s, i) => (
            <button
              key={s.label}
              className={`w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left ${
                i !== settings.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <div>
                <div className="text-[15px] font-medium text-gray-900">{s.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.hint}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
