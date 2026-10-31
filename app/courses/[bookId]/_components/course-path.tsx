"use client";

import { useEffect, useMemo, useState } from "react";
import { UnitMap, type CourseMapUnit } from "./unit-map";
import { cn } from "@/lib/utils";

interface CoursePathProps {
  bookId: string;
  units: CourseMapUnit[];
}

function getStorageKey(bookId: string) {
  return `word-battle:completed-lessons:${bookId}`;
}

function applyCompletedLessons(units: CourseMapUnit[], completedLessonIds: string[]) {
  const completedSet = new Set(completedLessonIds);
  const flatLessons = units.flatMap((unit) => unit.lessons);
  const firstIncompleteIndex = flatLessons.findIndex((lesson) => !completedSet.has(lesson.id));
  const currentIndex = firstIncompleteIndex === -1 ? flatLessons.length : firstIncompleteIndex;
  let seenLessons = 0;

  return units.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((lesson) => {
      const index = seenLessons++;
      const rawLessonId = lesson.id.replace(/^db-lesson-/, "");
      const completed = completedSet.has(lesson.id) || completedSet.has(rawLessonId);
      const current = index === currentIndex;
      const locked = !completed && index > currentIndex;

      return {
        ...lesson,
        completed,
        current,
        locked,
        percentage: completed ? 100 : current ? Math.max(lesson.percentage, 20) : 0,
      };
    }),
  }));
}

export function CoursePath({ bookId, units }: CoursePathProps) {
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [activeUnit, setActiveUnit] = useState(0);

  useEffect(() => {
    const raw = window.localStorage.getItem(getStorageKey(bookId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setCompletedLessonIds(parsed.map(String));
    } catch {
      setCompletedLessonIds([]);
    }
  }, [bookId]);

  const resolvedUnits = useMemo(
    () => applyCompletedLessons(units, completedLessonIds),
    [units, completedLessonIds],
  );

  // 默认聚焦到第一个含"当前关卡"的单元
  useEffect(() => {
    const idx = resolvedUnits.findIndex((u) => u.lessons.some((l) => l.current));
    if (idx !== -1) setActiveUnit(idx);
  }, [resolvedUnits]);

  const unit = resolvedUnits[activeUnit];

  return (
    <div className="space-y-6">
      {/* 单元切换：横向 tab，一眼看完所有单元 */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {resolvedUnits.map((u, i) => {
          const doneCount = u.lessons.filter((l) => l.completed).length;
          const total = u.lessons.length;
          const allDone = doneCount === total;
          const hasCurrent = u.lessons.some((l) => l.current);
          return (
            <button
              key={u.id}
              onClick={() => setActiveUnit(i)}
              className={cn(
                "shrink-0 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-colors border",
                i === activeUnit
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                  : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white",
              )}
            >
              <span>{u.title}</span>
              <span className={cn("ml-2 text-[11px] tabular-nums", i === activeUnit ? "opacity-60" : "text-gray-400")}>
                {doneCount}/{total}
                {hasCurrent && " · 当前"}
                {allDone && !hasCurrent && " · 完成"}
              </span>
            </button>
          );
        })}
      </div>

      {/* 当前单元的关卡网格 */}
      {unit && <UnitMap unit={unit} />}
    </div>
  );
}
