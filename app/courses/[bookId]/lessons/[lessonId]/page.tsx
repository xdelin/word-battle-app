import Link from "next/link";
import { fetchLessonDetail } from "@/lib/api-client";
import { LessonQuiz } from "./lesson-quiz";

interface LessonPageProps {
  params: {
    bookId: string;
    lessonId: string;
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const lessonId = Number(params.lessonId);

  if (Number.isNaN(lessonId)) {
    return <LessonNotFound bookId={params.bookId} />;
  }

  const lesson = await fetchLessonDetail(lessonId);
  if (!lesson) {
    return <LessonNotFound bookId={params.bookId} />;
  }

  return (
    <LessonQuiz
      bookId={params.bookId}
      lessonId={params.lessonId}
      title={lesson.title}
      questions={lesson.questions}
    />
  );
}

function LessonNotFound({ bookId }: { bookId: string }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 p-10 text-center">
        <div className="text-5xl mb-4">📚</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">关卡不存在</h1>
        <p className="text-sm text-gray-500 mb-6">请返回课程重新选择关卡。</p>
        <Link
          href={`/courses/${bookId}`}
          className="inline-flex h-11 px-6 items-center rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          返回课程
        </Link>
      </div>
    </main>
  );
}
