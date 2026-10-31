"use client";

import { useState, useTransition } from "react";
import { Target, Check } from "lucide-react";
import { updateDailyGoalLessonsJava } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DailyPlanProps {
  completedToday: number;
  dailyGoalLessons: number;
}

export function DailyPlan({ completedToday, dailyGoalLessons }: DailyPlanProps) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(dailyGoalLessons);
  const [savedGoal, setSavedGoal] = useState(dailyGoalLessons);
  const [pending, startTransition] = useTransition();

  const pct = Math.min(100, Math.round((completedToday / Math.max(1, savedGoal)) * 100));
  const done = completedToday >= savedGoal;

  const save = () => {
    startTransition(async () => {
      try {
        const s = await updateDailyGoalLessonsJava(goal);
        setSavedGoal(s.dailyGoalLessons);
        setGoal(s.dailyGoalLessons);
        setOpen(false);
      } catch (e) {
        console.warn("[daily-plan] update failed:", e);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">今日计划</span>
        </div>
        <button
          onClick={() => { setGoal(savedGoal); setOpen(true); }}
          className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          设置
        </button>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{completedToday}</span>
        <span className="text-sm text-gray-400">/ {savedGoal} 关</span>
        {done && <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">已达成 ✓</span>}
      </div>

      <div className="h-[3px] w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", done ? "bg-emerald-500" : "bg-gray-900 dark:bg-white")}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 设置弹窗 */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xs bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">每日目标</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">每天计划完成多少关卡</p>

            <div className="flex items-center justify-center gap-3 mb-6">
              <button
                onClick={() => setGoal((g) => Math.max(1, g - 1))}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 text-lg"
              >−</button>
              <span className="w-12 text-center text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{goal}</span>
              <button
                onClick={() => setGoal((g) => Math.min(50, g + 1))}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 text-lg"
              >+</button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-10 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >取消</button>
              <button
                onClick={save}
                disabled={pending || goal === savedGoal}
                className="flex-1 h-10 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {pending ? "保存中…" : goal === savedGoal ? <><Check className="h-4 w-4" />已设置</> : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
