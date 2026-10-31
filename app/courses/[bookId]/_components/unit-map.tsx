import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";

export interface CourseMapLesson {
  id: string;
  title: string;
  href: string;
  completed: boolean;
  current: boolean;
  locked: boolean;
  boss: boolean;
  percentage: number;
}

export interface CourseMapUnit {
  id: string;
  title: string;
  description: string;
  lessons: CourseMapLesson[];
}

interface UnitMapProps {
  unit: CourseMapUnit;
}

export function UnitMap({ unit }: UnitMapProps) {
  const currentLesson = unit.lessons.find((lesson) => lesson.current && !lesson.locked);
  const fallbackLesson = unit.lessons.find((lesson) => !lesson.locked);
  const continueHref = currentLesson?.href || fallbackLesson?.href || "#";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{unit.title}</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{unit.description}</p>
        </div>
        <a
          href={continueHref}
          className="shrink-0 ml-3 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {currentLesson ? "继续当前 →" : "开始 →"}
        </a>
      </div>

      {/* 关卡网格：紧凑卡片，不再蛇形 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {unit.lessons.map((lesson, index) => (
          <LessonCard key={lesson.id} lesson={lesson} index={index} total={unit.lessons.length} />
        ))}
      </div>
    </section>
  );
}

function LessonCard({ lesson, index, total }: { lesson: CourseMapLesson; index: number; total: number }) {
  const { completed, current, locked, boss, percentage, href, title } = lesson;

  return (
    <a
      href={locked ? undefined : href}
      aria-label={title}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-2xl border p-3 transition-colors",
        completed
          ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
          : current
            ? "border-gray-900 bg-white text-gray-900 dark:border-white dark:bg-gray-900 dark:text-white"
            : locked
              ? "border-gray-100 bg-gray-50/50 text-gray-300 dark:border-gray-800/60 dark:bg-gray-900/50 dark:text-gray-600 cursor-not-allowed"
              : "border-gray-100 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700",
      )}
    >
      {/* 顶部：序号 + 状态 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] tabular-nums opacity-60">
          {String(index + 1).padStart(2, "0")}
        </span>
        {completed && <Check className="h-3 w-3" strokeWidth={2.5} />}
        {locked && <Lock className="h-3 w-3" strokeWidth={2} />}
      </div>

      {/* 标题 */}
      <div className="text-xs font-medium leading-tight truncate">{title}</div>

      {/* 当前关卡的进度条 */}
      {current && (
        <div className="mt-1 h-[2px] w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-gray-900 dark:bg-white transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </a>
  );
}
