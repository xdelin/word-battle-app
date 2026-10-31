import type { Metadata } from "next";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "单词闯关 - 智能英语学习",
  description: "融合闯关学习、智能复习、单词PK的综合英语学习平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {/* 底部 tab bar 的 padding：所有端留 88px，避免内容被 tab 遮挡。
            闯关页用 fixed inset-0 全屏，不受此 padding 影响。 */}
        <div className="min-h-screen pb-[calc(88px+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}
