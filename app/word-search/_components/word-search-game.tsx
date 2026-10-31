"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface WordEntry {
  word: string;
  translation: string;
}

interface WordSearchGameProps {
  words: WordEntry[];
  onComplete: (elapsedMs: number) => void;
  onRestart?: () => void;
}

const SIZE = 10;
const DIRECTIONS = [
  [0, 1],  // 横向 →
  [1, 0],  // 竖向 ↓
];

interface PlacedWord {
  word: string;
  translation: string;
  cells: { r: number; c: number }[];
  found: boolean;
}

/** 把词放进 10×10 网格，剩余填随机字母 */
function buildGrid(words: WordEntry[]): { grid: string[][]; placed: PlacedWord[] } {
  const grid: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
  const placed: PlacedWord[] = [];

  // 按长度降序放，长的先放更容易成功
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length);

  for (const entry of sorted) {
    const w = entry.word.toUpperCase();
    let success = false;
    for (let attempt = 0; attempt < 200 && !success; attempt++) {
      const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const r0 = Math.floor(Math.random() * SIZE);
      const c0 = Math.floor(Math.random() * SIZE);
      const rEnd = r0 + dr * (w.length - 1);
      const cEnd = c0 + dc * (w.length - 1);
      if (rEnd < 0 || rEnd >= SIZE || cEnd < 0 || cEnd >= SIZE) continue;
      // 检查冲突
      let ok = true;
      for (let i = 0; i < w.length; i++) {
        const r = r0 + dr * i;
        const c = c0 + dc * i;
        if (grid[r][c] !== "" && grid[r][c] !== w[i]) { ok = false; break; }
      }
      if (!ok) continue;
      // 放置
      const cells: { r: number; c: number }[] = [];
      for (let i = 0; i < w.length; i++) {
        const r = r0 + dr * i;
        const c = c0 + dc * i;
        grid[r][c] = w[i];
        cells.push({ r, c });
      }
      placed.push({ word: entry.word, translation: entry.translation, cells, found: false });
      success = true;
    }
  }

  // 空格填随机字母
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === "") {
        grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
    }
  }
  return { grid, placed };
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function WordSearchGame({ words, onComplete, onRestart }: WordSearchGameProps) {
  // buildGrid 用 Math.random，SSR 与客户端结果不同会导致 hydration 错误。
  // 故只在客户端 mount 后构建，SSR 时返回空网格占位。
  const [gridState, setGridState] = useState<{ grid: string[][]; placed: PlacedWord[] } | null>(null);
  useEffect(() => {
    setGridState(buildGrid(words));
  }, [words]);
  const grid = gridState?.grid ?? Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
  const placed = gridState?.placed ?? [];
  const [foundSet, setFoundSet] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [path, setPath] = useState<{ r: number; c: number }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const startRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cellRectsRef = useRef<{ r: number; c: number; cx: number; cy: number }[]>([]);

  // 计时（仅客户端）
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!gridState) return;
    startRef.current = Date.now();
    setStarted(true);
  }, [gridState]);
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 500);
    return () => clearInterval(id);
  }, [started]);

  // 重新计算每个 cell 的中心坐标（拖拽命中用）
  const recomputeCellRects = useCallback(() => {
    if (!containerRef.current) return;
    const rects: { r: number; c: number; cx: number; cy: number }[] = [];
    const cells = containerRef.current.querySelectorAll("[data-cell]");
    const containerRect = containerRef.current.getBoundingClientRect();
    cells.forEach((el) => {
      const r = Number((el as HTMLElement).dataset.r);
      const c = Number((el as HTMLElement).dataset.c);
      const rect = (el as HTMLElement).getBoundingClientRect();
      rects.push({ r, c, cx: rect.left + rect.width / 2 - containerRect.left, cy: rect.top + rect.height / 2 - containerRect.top });
    });
    cellRectsRef.current = rects;
  }, []);

  const pathKey = (p: { r: number; c: number }[]) => p.map((x) => `${x.r},${x.c}`).join("|");

  const cellInPath = (r: number, c: number) => path.some((p) => p.r === r && p.c === c);

  const isCellFound = (r: number, c: number) =>
    placed.some((pw) => pw.found && pw.cells.some((cell) => cell.r === r && cell.c === c));

  const tryFindWord = (selectedPath: { r: number; c: number }[]) => {
    if (selectedPath.length < 3) return false;
    const letters = selectedPath.map((p) => grid[p.r][p.c]).join("");
    const reversed = letters.split("").reverse().join("");
    for (const pw of placed) {
      if (pw.found) continue;
      const w = pw.word.toUpperCase();
      if (letters === w || reversed === w) {
        // 命中：路径必须恰好覆盖该词所有格（防止子串误命中）
        const sameCells =
          selectedPath.length === pw.cells.length &&
          selectedPath.every((p) => pw.cells.some((cell) => cell.r === p.r && cell.c === p.c));
        if (sameCells) {
          setFoundSet((prev) => new Set(prev).add(pw.word));
          setToast(`${pw.word} · ${pw.translation}`);
          setTimeout(() => setToast(null), 1600);
          return true;
        }
      }
    }
    return false;
  };

  // 拖拽：根据触摸/鼠标坐标找最近的 cell
  const findCellAt = (clientX: number, clientY: number): { r: number; c: number } | null => {
    if (!containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = clientX - containerRect.left;
    const y = clientY - containerRect.top;
    let best: { r: number; c: number; d: number } | null = null;
    for (const cell of cellRectsRef.current) {
      const d = Math.hypot(cell.cx - x, cell.cy - y);
      if (!best || d < best.d) best = { ...cell, d };
    }
    return best && best.d < 40 ? { r: best.r, c: best.c } : null;
  };

  // 路径必须沿直线（水平/垂直）连续
  const tryExtendPath = (cell: { r: number; c: number }) => {
    setPath((prev) => {
      if (prev.length === 0) return [cell];
      const last = prev[prev.length - 1];
      if (last.r === cell.r && last.c === cell.c) return prev;
      // 判断是否在当前直线上
      if (prev.length === 1) {
        // 第二个点确定方向
        const dr = cell.r - last.r;
        const dc = cell.c - last.c;
        if (dr !== 0 && dc !== 0) return prev; // 必须水平或垂直
        return [...prev, cell];
      }
      // 已有方向：检查延续
      const first = prev[0];
      const isHorizontal = first.r === prev[1].r;
      const isVertical = first.c === prev[1].c;
      if (isHorizontal && cell.r === first.r && !prev.some((p) => p.r === cell.r && p.c === cell.c)) {
        // 必须在 first.c 和 last.c 之间且连续
        const cs = prev.map((p) => p.c).sort((a, b) => a - b);
        const minC = cs[0];
        const maxC = cs[cs.length - 1];
        if (cell.c === minC - 1 || cell.c === maxC + 1) return [...prev, cell];
        // 回退：点到已选路径中间，截断
        const idx = prev.findIndex((p) => p.c === cell.c);
        if (idx >= 0) return prev.slice(0, idx + 1);
      }
      if (isVertical && cell.c === first.c && !prev.some((p) => p.r === cell.r && p.c === cell.c)) {
        const rs = prev.map((p) => p.r).sort((a, b) => a - b);
        const minR = rs[0];
        const maxR = rs[rs.length - 1];
        if (cell.r === minR - 1 || cell.r === maxR + 1) return [...prev, cell];
        const idx = prev.findIndex((p) => p.r === cell.r);
        if (idx >= 0) return prev.slice(0, idx + 1);
      }
      return prev;
    });
  };

  const handleStart = (clientX: number, clientY: number) => {
    recomputeCellRects();
    const cell = findCellAt(clientX, clientY);
    if (cell) {
      setSelecting(true);
      setPath([cell]);
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!selecting) return;
    const cell = findCellAt(clientX, clientY);
    if (cell) tryExtendPath(cell);
  };

  const handleEnd = () => {
    if (!selecting) return;
    setSelecting(false);
    if (path.length >= 3) tryFindWord(path);
    setPath([]);
  };

  // 完成检测
  useEffect(() => {
    if (placed.length > 0 && foundSet.size === placed.length) {
      onComplete(Date.now() - startRef.current);
    }
  }, [foundSet, placed, onComplete]);

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 顶栏：计时 + 进度 + 重开（居中，重开不再贴最右） */}
      <div className="w-full flex items-center justify-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtTime(elapsed)}</span>
          <span className="text-[11px] text-gray-400 tabular-nums">
            {foundSet.size}/{placed.length}
          </span>
        </div>
        {onRestart && (
          <button
            onClick={onRestart}
            className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            重开
          </button>
        )}
      </div>

      {/* 主体：网格 + 词表 */}
      <div className="flex flex-col sm:flex-row gap-4 w-full">
        {/* 网格 */}
        <div
          ref={containerRef}
          className="relative select-none touch-none mx-auto sm:mx-0 sm:ml-8"
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => { const t = e.touches[0]; handleStart(t.clientX, t.clientY); }}
          onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; handleMove(t.clientX, t.clientY); }}
          onTouchEnd={handleEnd}
        >
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, width: "min(86vw, 360px)" }}
          >
            {grid.map((row, r) =>
              row.map((ch, c) => {
                const inPath = cellInPath(r, c);
                const found = isCellFound(r, c);
                return (
                  <div
                    key={`${r}-${c}`}
                    data-r={r}
                    data-c={c}
                    data-cell
                    className={`aspect-square flex items-center justify-center text-[13px] font-semibold rounded-[3px] transition-colors ${
                      found
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                        : inPath
                          ? "bg-gray-300 text-gray-900 dark:bg-gray-600 dark:text-white"
                          : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {ch}
                  </div>
                );
              })
            )}
          </div>

          {/* toast */}
          {toast && (
            <div className="absolute left-1/2 top-2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium whitespace-nowrap shadow-lg">
              {toast}
            </div>
          )}
        </div>

        {/* 词表（待找） */}
        <div className="min-w-0 sm:max-w-[200px]">
          <div className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">待找单词</div>
          <div className="space-y-1">
            {placed.map((pw) => (
              <div
                key={pw.word}
                className={`text-[13px] tabular-nums ${
                  foundSet.has(pw.word)
                    ? "text-gray-300 dark:text-gray-600 line-through"
                    : "text-gray-700 dark:text-gray-200"
                }`}
              >
                {pw.word} · <span className="text-gray-400 dark:text-gray-500">{pw.translation}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
