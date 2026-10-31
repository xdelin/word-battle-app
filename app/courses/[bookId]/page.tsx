import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { fetchCourseTree, fetchUserSettings, fetchTodayCompletedLessons } from "@/lib/api-client";
import { CoursePath } from "./_components/course-path";
import { DailyPlan } from "./_components/daily-plan";
import type { CourseMapUnit } from "./_components/unit-map";

const demoCourses = {
  "demo-cet4": {
    name: "大学英语四级核心词汇",
    description: "通过选择题、释义匹配和复习关卡，快速熟悉四级高频词。",
    completedLessons: 4,
    units: [
      {
        title: "Unit 1 · 高频基础词",
        description: "先掌握四级考试里最常出现的基础词汇。",
        lessons: [
          { title: "关卡 1", words: ["abandon", "ability"] },
          { title: "关卡 2", words: ["abnormal", "aboard"] },
          { title: "关卡 3", words: ["absolute", "absorb"] },
          { title: "关卡 4", words: ["abstract", "abundant"] },
          { title: "关卡 5", words: ["academic", "access"] },
          { title: "关卡 6", words: ["accident", "accompany"] },
          { title: "关卡 7", words: ["accumulate", "accurate"] },
          { title: "Boss 关卡", words: ["acknowledge", "achieve"], boss: true },
        ],
      },
      {
        title: "Unit 2 · 阅读常见词",
        description: "训练阅读理解中经常出现的动词和形容词。",
        lessons: [
          { title: "关卡 1", words: ["adapt", "adequate"] },
          { title: "关卡 2", words: ["adjust", "administration"] },
          { title: "关卡 3", words: ["advance", "advantage"] },
          { title: "关卡 4", words: ["affect", "afford"] },
          { title: "关卡 5", words: ["agency", "agenda"] },
          { title: "关卡 6", words: ["aggressive", "aid"] },
          { title: "关卡 7", words: ["alternative", "ambition"] },
          { title: "Boss 关卡", words: ["analysis", "annual"], boss: true },
        ],
      },
      {
        title: "Unit 3 · 写作加分词",
        description: "学习作文和翻译中能提升表达质量的核心词。",
        lessons: [
          { title: "关卡 1", words: ["approach", "appropriate"] },
          { title: "关卡 2", words: ["argument", "arrange"] },
          { title: "关卡 3", words: ["assume", "attach"] },
          { title: "关卡 4", words: ["attitude", "available"] },
          { title: "关卡 5", words: ["benefit", "challenge"] },
          { title: "关卡 6", words: ["circumstance", "claim"] },
          { title: "关卡 7", words: ["combine", "commit"] },
          { title: "Boss 关卡", words: ["conclude", "consistent"], boss: true },
        ],
      },
    ],
  },
  "demo-daily": {
    name: "日常英语高频词",
    description: "先从日常交流词汇开始，体验闯关学习的节奏。",
    completedLessons: 2,
    units: [
      {
        title: "Unit 1 · Everyday Words",
        description: "从最常见的问候、表达和日常交流词开始。",
        lessons: [
          { title: "关卡 1", words: ["hello", "thanks"] },
          { title: "关卡 2", words: ["morning", "evening"] },
          { title: "关卡 3", words: ["please", "sorry"] },
          { title: "关卡 4", words: ["family", "friend"] },
          { title: "关卡 5", words: ["today", "tomorrow"] },
          { title: "关卡 6", words: ["school", "office"] },
          { title: "Boss 关卡", words: ["question", "answer"], boss: true },
        ],
      },
      {
        title: "Unit 2 · Simple Conversation",
        description: "用简单词汇完成日常对话。",
        lessons: [
          { title: "关卡 1", words: ["coffee", "water"] },
          { title: "关卡 2", words: ["ticket", "station"] },
          { title: "关卡 3", words: ["doctor", "hospital"] },
          { title: "关卡 4", words: ["market", "price"] },
          { title: "关卡 5", words: ["weather", "season"] },
          { title: "Boss 关卡", words: ["travel", "holiday"], boss: true },
        ],
      },
    ],
  },
};

interface CoursePageProps {
  params: {
    bookId: string;
  };
}

function buildDemoUnits(bookId: string, course: (typeof demoCourses)[keyof typeof demoCourses]): CourseMapUnit[] {
  let seenLessons = 0;
  const currentLessonIndex = course.completedLessons;

  return course.units.map((unit, unitIndex) => ({
    id: `${bookId}-unit-${unitIndex + 1}`,
    title: unit.title,
    description: unit.description,
    lessons: unit.lessons.map((lesson, lessonIndex) => {
      const globalLessonIndex = seenLessons++;
      const completed = globalLessonIndex < course.completedLessons;
      const current = globalLessonIndex === currentLessonIndex;
      const locked = globalLessonIndex > currentLessonIndex;
      const boss = Boolean(lesson.boss) || lessonIndex === unit.lessons.length - 1;

      return {
        id: `${bookId}-unit-${unitIndex + 1}-lesson-${lessonIndex + 1}`,
        title: lesson.title,
        href: `/courses/${bookId}/demo-lesson?unit=${unitIndex + 1}&lesson=${lessonIndex + 1}`,
        completed,
        current,
        locked,
        boss,
        percentage: current ? 35 : completed ? 100 : 0,
      };
    }),
  }));
}

/** 课程树映射到 buildDbUnits 所需的最小形状。 */
type UnitShape = {
  id: number;
  title: string;
  description: string;
  lessons: {
    id: number;
    title: string;
    isBossLesson: boolean | null;
    totalChallenges: number;
    isCompleted: boolean;
  }[];
};

/** 加载课程树（Java 后端；演示模式由 api-client 内部走 mock）。 */
async function loadCourseData(numericBookId: number): Promise<{
  name: string;
  description: string;
  units: UnitShape[];
} | null> {
  const tree = await fetchCourseTree(numericBookId);
  const firstCourse = tree.courses[0];
  if (!firstCourse) return null;
  return {
    name: tree.book.name,
    description: tree.book.description,
    units: firstCourse.units.map((u) => ({
      id: u.id,
      title: u.title,
      description: u.description,
      lessons: u.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        isBossLesson: l.isBossLesson,
        totalChallenges: l.totalChallenges,
        isCompleted: l.isCompleted,
      })),
    })),
  };
}

/** 加载每日目标与今日完成数。 */
async function loadSettingsAndToday(): Promise<{
  dailyGoalLessons: number;
  completedToday: number;
}> {
  const [settings, completedToday] = await Promise.all([
    fetchUserSettings(),
    fetchTodayCompletedLessons(),
  ]);
  return { dailyGoalLessons: settings.dailyGoalLessons, completedToday };
}

function buildDbUnits(bookId: string, dbUnits: UnitShape[]): CourseMapUnit[] {
  const allLessons = dbUnits.flatMap((unit) => unit.lessons);
  const currentLessonIndex = allLessons.findIndex((lesson) => !lesson.isCompleted);
  const activeIndex = currentLessonIndex === -1 ? allLessons.length : currentLessonIndex;
  let seenLessons = 0;

  return dbUnits.map((unit) => ({
    id: `db-unit-${unit.id}`,
    title: unit.title,
    description: unit.description,
    lessons: unit.lessons.map((lesson: any) => {
      const globalLessonIndex = seenLessons++;
      const completed = lesson.isCompleted;
      const current = globalLessonIndex === activeIndex;
      const locked = !completed && globalLessonIndex > activeIndex;
      const totalChallenges = Math.max(lesson.totalChallenges, 1);
      const percentage = completed ? 100 : current ? Math.min(75, Math.round(100 / totalChallenges)) : 0;

      return {
        id: `db-lesson-${lesson.id}`,
        title: lesson.title,
        href: `/courses/${bookId}/lessons/${lesson.id}`,
        completed,
        current,
        locked,
        boss: lesson.isBossLesson,
        percentage,
      };
    }),
  }));
}

function NotReadyState() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#fafafa] dark:bg-gray-950 p-6">
      <div className="max-w-md w-full text-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-10">
        <div className="text-5xl mb-4">📚</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">课程暂未准备好</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          请选择演示词库，或确认数据库里已经导入课程数据。
        </p>
        <Link href="/courses" className="inline-flex mt-6 h-11 px-6 items-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors">
          返回词库列表
        </Link>
      </div>
    </main>
  );
}

export default async function CoursePage({ params }: CoursePageProps) {
  const demoCourse = demoCourses[params.bookId as keyof typeof demoCourses];
  let courseName = demoCourse?.name;
  let courseDescription = demoCourse?.description;
  let units = demoCourse ? buildDemoUnits(params.bookId, demoCourse) : [];
  let isDemo = Boolean(demoCourse);

  if (!demoCourse) {
    const numericBookId = Number(params.bookId);

    if (Number.isNaN(numericBookId)) {
      return <NotReadyState />;
    }

    try {
      const data = await loadCourseData(numericBookId);
      if (!data) return <NotReadyState />;
      courseName = data.name;
      courseDescription = data.description;
      units = buildDbUnits(params.bookId, data.units);
      isDemo = false;
    } catch (error) {
      console.error("Failed to load course map:", error);
      return <NotReadyState />;
    }
  }

  if (!courseName || !courseDescription || units.length === 0) {
    return <NotReadyState />;
  }
  const totalLessons = units.reduce((sum, unit) => sum + unit.lessons.length, 0);
  const completedLessons = units.reduce(
    (sum, unit) => sum + unit.lessons.filter((lesson) => lesson.completed).length,
    0
  );

  // 学习计划：每日目标 + 今日完成数
  const { dailyGoalLessons, completedToday } = await loadSettingsAndToday();

  return (
    <main data-source={isDemo ? "demo" : "java"} className="min-h-[100dvh] bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-3">课程</div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">{courseName}</h1>
            <p className="mt-3 text-base text-gray-500 dark:text-gray-400 font-light">{courseDescription}</p>
          </div>
          <Link
            href="/courses"
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="换一本词书"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>换词书</span>
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{completedLessons}/{totalLessons}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">已完成关卡</div>
          </div>
          <div className="h-1 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="text-xs text-gray-400">
            {isDemo ? "演示模式" : "真实词库"}
          </div>
        </div>

        <DailyPlan completedToday={completedToday} dailyGoalLessons={dailyGoalLessons} />

        <CoursePath bookId={params.bookId} units={units} />
      </div>
    </main>
  );
}
