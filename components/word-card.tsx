"use client";

import { useState, useMemo, useEffect } from "react";
import { Volume2, Brain, Check, Bookmark } from "lucide-react";

export interface WordCardData {
  word: string;
  phonetic?: string | null;        // IPA 音标
  translation?: string | null;     // 中文释义
  example?: string | null;         // 单条例句（兼容旧字段）
  examples?: { text: string; translation?: string | null; ref?: string | null }[] | null;  // 双语例句
  audioUrl?: string | null;
  tags?: string[] | null;
  difficulty?: number | null;
  // dictionary 富字段
  definitions?: { pos: string; gloss: string }[] | null;  // 英文释义（Wiktionary）
  etymology?: string | null;       // 词源（作助记）
  forms?: { form: string; tags: string[] }[] | null;       // 词形变化
  synonyms?: string[] | null;
  antonyms?: string[] | null;
  related?: string[] | null;       // 相关词 / 派生
  frequency?: number | null;       // 词频
  discrimination?: string | null;  // 近义辨析
  collocations?: { phrase: string; meaning: string }[] | null;  // 常用短语 [{phrase, meaning}]
  confusable?: { word: string; meaning: string }[] | null;  // 易混淆词（形近/音近）[{word, meaning}]，meaning 为中文释义
}

interface WordCardProps {
  data: WordCardData;
  /** 是否显示答案区（false 时只显示单词头，主流背词的"先回忆"模式） */
  revealed: boolean;
  /** 复习次数/正确次数等元信息 */
  progress?: { totalReviews: number; totalCorrect: number } | null;
  /** 单词头是否显示发音按钮 */
  showSpeak?: boolean;
  className?: string;
  /** 右上角按钮是否处于「已激活」态（已熟记/已加入） */
  mastered?: boolean;
  /** 点右上角按钮回调；不传则不显示按钮 */
  onMaster?: () => void;
  /** 右上角按钮文案：默认「熟记」，可改为「加入复习」等 */
  actionLabel?: string;
  /** 激活态文案：默认「已熟记」，可改为「已加入」 */
  actionActiveLabel?: string;
}

// 底部切换栏只切这 3 项；中文释义 / 双语例句 常驻显示
type TabKey = "phrases" | "discrim" | "similar" | "en";

/**
 * 统一词性标注为短格式（n. / v. / vt. / vi. / adj. / adv. / prep. / conj. / pron. / art. / aux. / num. / int.）
 * 兼容 ECDICT 的缩写（n. vt. a.）和 Wiktionary 的全称（noun verb adjective）。
 */
function normalizePos(raw: string): string {
  const s = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    noun: "n.",
    nouns: "n.",
    verb: "v.",
    verbs: "v.",
    "transitive verb": "vt.",
    "intransitive verb": "vi.",
    adjective: "adj.",
    adjectives: "adj.",
    adverb: "adv.",
    adverbs: "adv.",
    preposition: "prep.",
    conjunction: "conj.",
    pronoun: "pron.",
    article: "art.",
    determiner: "art.",
    auxiliary: "aux.",
    numeral: "num.",
    interjection: "int.",
    // ECDICT 的 a. = adjective
    "a.": "adj.",
  };
  if (map[s]) return map[s];
  // 已经是短格式（n. v. vt. 等）直接返回，统一小写点
  const shortMatch = s.match(/^(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux)\.$/);
  if (shortMatch) return s;
  // 其它（如带方括号的 [计]）原样返回
  return raw.trim();
}

/**
 * 把 "n. 节目, 程序; vt. 规划; vi. 编程" 解析成
 * [{ pos: "n.", def: "节目, 程序" }, { pos: "vt.", def: "规划" }, ...]
 *
 * 注意：ECDICT 的 translation 里换行是字面量 "\n"（反斜杠+n 两个字符），
 * 不是真正的换行符。这里先归一成真换行，再和 ; ；一起作为分隔切。
 */
function parseTranslation(t: string): { pos: string; def: string }[] {
  if (!t) return [];
  const normalized = t.replace(/\\n/g, "\n").replace(/\r/g, "\n");
  const segments = normalized.split(/[;；\n]/).map(s => s.trim()).filter(Boolean);
  const posRe = /^(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.|pron\.|num\.|art\.|int\.|aux\.|a\.|\[[^\]]+\])\s*/i;
  return segments.map(seg => {
    const m = seg.match(posRe);
    if (m) return { pos: normalizePos(m[1]), def: seg.slice(m[0].length).trim() };
    return { pos: "", def: seg };
  });
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

export function WordCard({ data, revealed, progress, showSpeak = true, className = "", mastered, onMaster, actionLabel = "熟记", actionActiveLabel = "已熟记" }: WordCardProps) {
  const [tab, setTab] = useState<TabKey>("phrases");
  // 例句弹窗：exRendered 控制是否在 DOM，exSlidIn 控制 transform（滑入/滑出）
  const [exRendered, setExRendered] = useState(false);
  const [exSlidIn, setExSlidIn] = useState(false);
  const defs = useMemo(() => parseTranslation(data.translation || ""), [data.translation]);

  // 打开：渲染后下一帧滑入（只依赖 exRendered，关闭时不干预）
  useEffect(() => {
    if (!exRendered) return;
    const raf = requestAnimationFrame(() => setExSlidIn(true));
    return () => cancelAnimationFrame(raf);
  }, [exRendered]);

  const openExamples = () => {
    setExSlidIn(false);
    setExRendered(true);
  };
  const closeExamples = () => {
    setExSlidIn(false); // 触发滑出，onTransitionEnd 后卸载
  };

  // 单词头永远显示，下方答案区只有 revealed 时才显示
  return (
    <div className={`flex flex-col gap-3 min-h-0 mt-6 ${className}`}>
      {/* 单词头：单词 + 音标 + 中文释义（裸露，左对齐，无背景；固定不压缩） */}
      <div className="relative px-4 shrink-0">
        {/* 熟记按钮：右上角 */}
        {onMaster && (
          <button
            onClick={onMaster}
            className={`absolute right-0 top-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors ${
              mastered
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-white"
            }`}
            title={mastered ? actionActiveLabel : actionLabel}
          >
            {mastered ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
            {mastered ? actionActiveLabel : actionLabel}
          </button>
        )}
        <div className="flex items-baseline gap-3 pr-20">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
            {data.word}
          </h1>
        </div>
        {/* 音标 + 播放按钮：单词和中文释义之间 */}
        {(data.phonetic || showSpeak) && (
          <div className="mt-2.5 flex items-center gap-2">
            {data.phonetic && (
              <span className="text-sm text-gray-400 dark:text-gray-500 font-light tracking-wide">
                /{data.phonetic}/
              </span>
            )}
            {showSpeak && (
              <button
                onClick={() => speak(data.word)}
                className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                aria-label="发音"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {/* 中文释义（裸露，紧贴音标下方） */}
        {revealed && defs.length > 0 && (
          <div className="mt-2.5 space-y-0.5">
            {defs.map((d, i) => (
              <div key={i} className="text-[15px] leading-7 text-gray-800 dark:text-gray-100">
                {d.pos && <span className="text-gray-900 dark:text-white">{d.pos} </span>}
                {d.def}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 答案区 */}
      {!revealed ? (
        <div className="flex-1 flex flex-col items-center justify-center px-1 text-gray-400">
          <div className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-2">
            <Brain className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <span className="text-sm">先回忆一下，再展开释义</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* 双语例句：独立矩形背景栏，只显示 1 句，右下角"更多"按钮弹全部 */}
          <section className="relative rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 pb-8">
            {(() => {
              const exs = data.examples?.length ? data.examples : (data.example ? [{ text: data.example }] : []);
              if (!exs.length) return <EmptyTab text="暂无例句" />;
              const first = exs[0];
              return (
                <>
                  <div className="text-[15px] leading-7 text-gray-700 dark:text-gray-200">
                    {first.text}
                    {first.translation && (
                      <div className="mt-1 text-[13px] leading-6 text-gray-500 dark:text-gray-400">
                        {first.translation}
                      </div>
                    )}
                  </div>
                  {exs.length > 1 && (
                    <button
                      onClick={() => openExamples()}
                      className="absolute right-3 bottom-2 text-[15px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <span className="flex flex-col items-start gap-[3px]"><span className="h-[1.5px] w-4 rounded-full bg-current" /><span className="h-[1.5px] w-3 rounded-full bg-current" /><span className="h-[1.5px] w-2 rounded-full bg-current" /></span>
                    </button>
                  )}
                </>
              );
            })()}
          </section>

          {/* 全部例句弹窗（全屏，从右侧滑入/滑出，底部收起按钮） */}
          {exRendered && (() => {
            const exs = data.examples?.length ? data.examples : (data.example ? [{ text: data.example }] : []);
            return (
              <div
                className="fixed inset-0 z-50 bg-[#fafafa] dark:bg-gray-950 flex flex-col transition-transform duration-300 ease-out"
                style={{ transform: exSlidIn ? "translateX(0)" : "translateX(100%)" }}
                onTransitionEnd={(e) => {
                  // 只响应 transform 过渡结束（避免子元素 opacity 等触发误卸载）
                  if (e.propertyName === "transform" && !exSlidIn) setExRendered(false);
                }}
              >
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-2xl mx-auto px-8 py-10">
                    {/* 矩形背景框，固定高度，内部滚动 */}
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 h-[60dvh] overflow-y-auto mb-8">
                      <div className="space-y-8">
                        {exs.map((ex, i) => (
                          <div key={i} className="text-[17px] leading-9 text-gray-800 dark:text-gray-100">
                            {ex.text}
                            {ex.translation && (
                              <div className="mt-3 text-[14px] leading-7 text-gray-500 dark:text-gray-400">
                                {ex.translation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {/* 底部线移到中下部 */}
                <div className="flex-shrink-0 px-8 pb-14 pt-3">
                  <button
                    onClick={() => closeExamples()}
                    className="w-full max-w-2xl mx-auto h-16 flex flex-col items-center justify-center gap-1 text-gray-900 dark:text-white active:opacity-60"
                  >
                    <span className="text-[15px] font-medium">收起</span>
                    <span className="h-1 w-10 rounded-full bg-gray-900 dark:bg-white" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 切换面板：短语 / 近义辨析 / 英语释义 —— 独立矩形背景栏（内容超长时本区内部滚动） */}
          <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 pt-6 pb-3 mb-6 min-h-0 flex-1 flex flex-col">
            {/* 内容区（占满剩余空间，内部独立滚动，tab 按钮固定底部不滚） */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {tab === "phrases" && (
                <div className="animate-fadeIn space-y-1.5">
                  {data.collocations?.length ? (
                    data.collocations.map((c, i) => (
                      <div key={i} className="flex gap-2 text-[14px] text-left">
                        <span className="font-medium text-gray-900 dark:text-white shrink-0">{c.phrase}</span>
                        <span className="text-gray-500 dark:text-gray-400">{c.meaning}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyTab text="暂无常用短语" />
                  )}
                </div>
              )}

              {tab === "discrim" && (
                <div className="animate-fadeIn">
                  {data.discrimination ? (
                    <p className="text-[14px] leading-7 text-gray-600 dark:text-gray-300 whitespace-pre-line">{data.discrimination}</p>
                  ) : (
                    <EmptyTab text="暂无辨析" />
                  )}
                </div>
              )}

              {tab === "similar" && (
                <div className="animate-fadeIn space-y-2">
                  {data.confusable?.length ? (
                    data.confusable.map((c, i) => (
                      <div key={i} className="text-[15px] leading-7 text-gray-800 dark:text-gray-100">
                        <span className="font-medium text-gray-900 dark:text-white">{c.word}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2 text-[13px]">{c.meaning}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyTab text="暂无相似词" />
                  )}
                </div>
              )}

              {tab === "en" && (
                <div className="animate-fadeIn space-y-0.5">
                  {data.definitions?.length ? (
                    data.definitions.map((d, i) => (
                      <div key={i} className="text-[15px] leading-7 text-gray-800 dark:text-gray-100">
                        {d.pos && <span className="text-gray-900 dark:text-white">{normalizePos(d.pos)} </span>}
                        {d.gloss}
                      </div>
                    ))
                  ) : (
                    <EmptyTab text="暂无英文释义" />
                  )}
                </div>
              )}
            </div>

            {/* 切换栏（移到底部，左下） */}
            <div className="flex items-center gap-1.5 mt-3 shrink-0">
              {[
                { k: "phrases" as const, label: "短语" },
                { k: "discrim" as const, label: "近义辨析" },
                { k: "similar" as const, label: "相似词" },
                { k: "en" as const, label: "英语释义" },
              ].map(t => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors ${
                    tab === t.k
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

function EmptyTab({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="text-center py-2">
      <div className="text-sm text-gray-400">{text}</div>
      {hint && <div className="mt-1 text-[11px] text-gray-300 dark:text-gray-600">{hint}</div>}
    </div>
  );
}
