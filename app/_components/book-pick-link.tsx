"use client";

import { useRouter } from "next/navigation";
import { ReactNode } from "react";

const CURRENT_BOOK_KEY = "word-battle:current-book-id";

interface BookPickLinkProps {
  bookId: number | string;
  children: ReactNode;
  className?: string;
}

/**
 * 点击词书：先写 localStorage 记住"当前词书"，再跳到该词书的闯关页。
 * 这样首页/底部 tab 的"学习"按钮下次能直跳这本词书。
 */
export function BookPickLink({ bookId, children, className }: BookPickLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.localStorage.setItem(CURRENT_BOOK_KEY, String(bookId));
    router.push(`/courses/${bookId}`);
  };

  return (
    <a href={`/courses/${bookId}`} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
