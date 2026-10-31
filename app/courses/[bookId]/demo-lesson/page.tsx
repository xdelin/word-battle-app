"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const demoQuestions = [
  {
    word: "abandon",
    question: "abandon 的中文意思是？",
    options: ["抛弃；放弃", "吸收", "准确的", "能力"],
    answer: 0,
  },
  {
    word: "ability",
    question: "ability 的中文意思是？",
    options: ["事故", "能力；才能", "陪伴", "承认"],
    answer: 1,
  },
  {
    word: "accurate",
    question: "accurate 的中文意思是？",
    options: ["反常的", "登上", "准确的；精确的", "学术的"],
    answer: 2,
  },
];

interface DemoLessonPageProps {
  params: {
    bookId: string;
  };
}

export default function DemoLessonPage({ params }: DemoLessonPageProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = demoQuestions[questionIndex];
  const answered = selectedAnswer !== null;
  const isCorrect = selectedAnswer === question.answer;

  const selectAnswer = (answerIndex: number) => {
    if (answered) return;
    setSelectedAnswer(answerIndex);
    if (answerIndex === question.answer) {
      setScore((currentScore) => currentScore + 1);
    }
  };

  const nextQuestion = () => {
    if (questionIndex + 1 >= demoQuestions.length) {
      setFinished(true);
      return;
    }

    setQuestionIndex((currentIndex) => currentIndex + 1);
    setSelectedAnswer(null);
  };

  const restart = () => {
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="text-6xl mb-4">🎉</div>
            <CardTitle>演示关卡完成！</CardTitle>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              得分：{score}/{demoQuestions.length}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={restart} className="w-full">再试一次</Button>
            <Link href={`/courses/${params.bookId}`}>
              <Button variant="outline" className="w-full">返回课程</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href={`/courses/${params.bookId}`} className="inline-flex text-blue-600 dark:text-blue-400 hover:underline">
          ← 返回课程
        </Link>

        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">进度</div>
            <div className="font-bold text-gray-900 dark:text-white">
              {questionIndex + 1}/{demoQuestions.length}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">得分</div>
            <div className="font-bold text-yellow-500">{score}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">生命值</div>
            <div className="font-bold text-red-500">❤️❤️❤️❤️❤️</div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="text-center space-y-3">
              <div className="text-5xl">🧠</div>
              <CardTitle>{question.word}</CardTitle>
              <p className="text-gray-600 dark:text-gray-300">{question.question}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {question.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isAnswer = question.answer === index;
                const resultClass = answered && isAnswer
                  ? "bg-green-600 hover:bg-green-600 text-white"
                  : answered && isSelected && !isAnswer
                    ? "bg-red-600 hover:bg-red-600 text-white"
                    : "";

                return (
                  <Button
                    key={option}
                    variant="outline"
                    className={`h-16 text-base ${resultClass}`}
                    disabled={answered}
                    onClick={() => selectAnswer(index)}
                  >
                    {option}
                  </Button>
                );
              })}
            </div>

            {answered && (
              <div className={`rounded-lg p-4 text-center ${isCorrect ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"}`}>
                {isCorrect ? "回答正确！" : `回答错误，正确答案是：${question.options[question.answer]}`}
              </div>
            )}

            {answered && (
              <Button onClick={nextQuestion} className="w-full">
                {questionIndex + 1 >= demoQuestions.length ? "完成关卡" : "下一题"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
