/**
 * 纯静态演示数据。无数据库/无 Java 后端时用。
 *
 * 覆盖：词书列表、课程树、关卡详情、复习队列、找词词条、用户设置、统计。
 * 所有 id 用稳定的小整数，保证页面间跳转链路一致。
 */

// ===========================================
// 词书
// ===========================================

export interface MockBook {
  id: number;
  name: string;
  shortName: string;
  description: string;
  level: string;
  category: string;
  imageUrl: string;
  totalWords: number;
  createdAt: Date;
}

export const MOCK_BOOKS: MockBook[] = [
  { id: 1, name: "大学英语四级大纲词汇", shortName: "CET4", description: "大学英语四级考试大纲词汇（演示数据）", level: "L3", category: "四级", imageUrl: "/books/cet4.png", totalWords: 3849, createdAt: new Date("2026-07-01") },
  { id: 2, name: "大学英语六级大纲词汇", shortName: "CET6", description: "大学英语六级考试大纲词汇（演示数据）", level: "L4", category: "六级", imageUrl: "/books/cet6.png", totalWords: 5407, createdAt: new Date("2026-07-01") },
  { id: 3, name: "考研英语（一）大纲词汇", shortName: "KY1", description: "考研英语一大纲词汇（演示数据）", level: "L5", category: "考研", imageUrl: "/books/ky1.png", totalWords: 4801, createdAt: new Date("2026-07-01") },
  { id: 4, name: "托福核心词汇", shortName: "TOEFL", description: "托福核心词汇（演示数据）", level: "L6", category: "托福", imageUrl: "/books/toefl.png", totalWords: 6974, createdAt: new Date("2026-07-01") },
  { id: 5, name: "雅思核心词汇", shortName: "IELTS", description: "雅思核心词汇（演示数据）", level: "L6", category: "雅思", imageUrl: "/books/ielts.png", totalWords: 5040, createdAt: new Date("2026-07-01") },
];

export const MOCK_DEFAULT_BOOK = MOCK_BOOKS[0];

export const MOCK_LIBRARY_STATS = {
  totalWords: 26071,
  totalLessons: 4273,
  bookCount: MOCK_BOOKS.length,
};

// ===========================================
// 课程树（每本词书一门课，下挂单元与关卡）
// ===========================================

export interface MockLesson {
  id: number;
  unitId: number;
  title: string;
  description: string | null;
  order: number;
  isBossLesson: boolean;
  totalChallenges: number;
  isCompleted: boolean;
}

export interface MockUnit {
  id: number;
  courseId: number;
  title: string;
  description: string;
  order: number;
  lessons: MockLesson[];
}

export interface MockCourse {
  id: number;
  bookId: number;
  title: string;
  description: string;
  order: number;
  units: MockUnit[];
}

/** 给某词书生成演示课程树（6 单元 × 4 关，前几关标记完成）。 */
function buildCourse(bookId: number, title: string): MockCourse {
  const units: MockUnit[] = [];
  for (let u = 1; u <= 6; u++) {
    const lessons: MockLesson[] = [];
    for (let l = 1; l <= 4; l++) {
      const lessonOrder = (u - 1) * 4 + l;
      lessons.push({
        id: bookId * 1000 + u * 10 + l,
        unitId: bookId * 100 + u,
        title: `关卡 ${l}`,
        description: null,
        order: lessonOrder,
        isBossLesson: l === 4,
        totalChallenges: 10,
        // 前两关标记已完成，第三关当前
        isCompleted: lessonOrder <= 2,
      });
    }
    units.push({
      id: bookId * 100 + u,
      courseId: bookId * 10,
      title: `Unit ${u}`,
      description: `${title} · 第 ${u} 单元`,
      order: u,
      lessons,
    });
  }
  return { id: bookId * 10, bookId, title: `${title} · 闯关`, description: title, order: 1, units };
}

export const MOCK_COURSES: Record<number, MockCourse> = {
  1: buildCourse(1, "大学英语四级大纲词汇"),
  2: buildCourse(2, "大学英语六级大纲词汇"),
  3: buildCourse(3, "考研英语（一）大纲词汇"),
  4: buildCourse(4, "托福核心词汇"),
  5: buildCourse(5, "雅思核心词汇"),
};

// ===========================================
// 关卡详情（题目 + 选项 + 单词卡）
// ===========================================

/** 演示单词库（每本词书共用，按 lessonId 轮转取 10 个）。 */
export const MOCK_WORDS = [
  { word: "abandon", ipa: "/əˈbæn.dən/", translation: "vt. 放弃，抛弃，遗弃\nn. 放任，无拘束",
    enDefinition: "vt. To give up or relinquish control of.",
    definition: "To leave completely; to give up completely.",
    example: "The captain decided to abandon the sinking ship to save the crew.",
    exampleTrans: "船长决定放弃正在下沉的船以拯救船员。",
    discrimination: "abandon / desert / give up：abandon 指完全放弃，常含永远抛弃之意；desert 强调违背义务或责任而抛弃；give up 较为口语。",
    collocations: [{ phrase: "abandon hope", meaning: "放弃希望" }, { phrase: "abandon oneself to", meaning: "沉溺于" }, { phrase: "abandon the plan", meaning: "放弃计划" }], confusable: [{ word: "abundant", meaning: "adj. 丰富的，充裕的" }, { word: "abound", meaning: "v. 大量存在，有许多" }, { word: "band", meaning: "n. 乐队；带子，箍" }] },
  { word: "ability", ipa: "/əˈbɪl.ə.ti/", translation: "n. 能力，才干",
    enDefinition: "n. The skill or power to do something.",
    definition: "The skill or power to do something.",
    example: "She has the natural ability to learn foreign languages quickly.",
    exampleTrans: "她天生就有快速学习外语的能力。",
    discrimination: "ability / capacity / capability：ability 指做某事的能力；capacity 侧重容纳或吸收的能力；capability 指潜在能力。",
    collocations: [{ phrase: "show one's ability", meaning: "展现某人的能力" }, { phrase: "to the best of one's ability", meaning: "尽某人所能" }], confusable: [{ word: "agility", meaning: "n. 敏捷，灵活" }, { word: "facility", meaning: "n. 设施；天赋" }, { word: "utility", meaning: "n. 实用，效用" }] },
  { word: "absolute", ipa: "/ˈæb.sə.luːt/", translation: "a. 绝对的，完全的",
    enDefinition: "adj. Complete and total; not limited.",
    definition: "Complete and total; not limited in any way.",
    example: "He has absolute confidence in his team's ability to win.",
    exampleTrans: "他对团队获胜的能力有绝对的信心。",
    discrimination: "absolute / complete / total：absolute 强调无任何限制条件；complete 侧重各部分齐全；total 侧重数量上的全部。",
    collocations: [{ phrase: "absolute majority", meaning: "绝对多数" }, { phrase: "absolute silence", meaning: "绝对安静" }], confusable: [{ word: "agility", meaning: "n. 敏捷，灵活" }, { word: "facility", meaning: "n. 设施；天赋" }, { word: "utility", meaning: "n. 实用，效用" }] },
  { word: "absorb", ipa: "/əbˈzɔːb/", translation: "vt. 吸收，理解",
    enDefinition: "vt. To take in liquid, gas, or information.",
    definition: "To take in liquid, gas, or information.",
    example: "Plants absorb carbon dioxide from the air to grow.",
    exampleTrans: "植物从空气中吸收二氧化碳以生长。",
    discrimination: "absorb / assimilate：absorb 指吸收液体或信息；assimilate 强调消化吸收后同化为自己的一部分。",
    collocations: [{ phrase: "absorb knowledge", meaning: "吸收知识" }, { phrase: "be absorbed in", meaning: "全神贯注于" }], confusable: [{ word: "absorb", meaning: "vt. 吸收，理解" }, { word: "absolve", meaning: "vt. 免除，赦免" }, { word: "obsolete", meaning: "adj. 废弃的，过时的" }] },
  { word: "abstract", ipa: "/ˈæb.strækt/", translation: "a. 抽象的\nn. 摘要",
    enDefinition: "adj. Existing as an idea rather than physical.",
    definition: "Existing as an idea or concept rather than as a physical object.",
    example: "Beauty is an abstract concept that means different things to different people.",
    exampleTrans: "美是一个抽象的概念，对不同的人意味着不同的事物。",
    discrimination: "abstract / concrete：abstract 指概念上的、非具体的；concrete 指具体的、有形的。",
    collocations: [{ phrase: "abstract noun", meaning: "抽象名词" }, { phrase: "in the abstract", meaning: "抽象地" }], confusable: [{ word: "absurd", meaning: "adj. 荒谬的" }, { word: "observe", meaning: "v. 观察" }, { word: "preserve", meaning: "vt. 保存" }] },
  { word: "academic", ipa: "/ˌæk.əˈdem.ɪk/", translation: "a. 学术的，学院的",
    enDefinition: "adj. Relating to education and scholarship.",
    definition: "Relating to education and scholarship.",
    example: "The professor published several academic papers on climate change.",
    exampleTrans: "这位教授发表了多篇关于气候变化的学术论文。",
    discrimination: "academic / scholarly：academic 侧重学院式的；scholarly 强调有学问的、严谨的。",
    collocations: [{ phrase: "academic year", meaning: "学年" }, { phrase: "academic research", meaning: "学术研究" }], confusable: [{ word: "attract", meaning: "vt. 吸引" }, { word: "contract", meaning: "n. 合同" }, { word: "subtract", meaning: "v. 减去" }] },
  { word: "access", ipa: "/ˈækses/", translation: "n. 通路，入口，使用权\nvt. 接近",
    enDefinition: "n. The right to use or look at something.",
    definition: "The right or opportunity to use or look at something.",
    example: "Students have free access to the library's online resources.",
    exampleTrans: "学生可以免费使用图书馆的在线资源。",
    discrimination: "access / approach：access 侧重进入或使用的权利；approach 侧重接近的方式或途径。",
    collocations: [{ phrase: "have access to", meaning: "有权使用" }, { phrase: "gain access", meaning: "获得访问权" }], confusable: [{ word: "academy", meaning: "n. 学院" }, { word: "acoustic", meaning: "adj. 声学的" }, { word: "epidemic", meaning: "n. 流行病" }] },
  { word: "accommodate", ipa: "/əˈkɒm.ə.deɪt/", translation: "vt. 容纳，提供住宿",
    enDefinition: "vt. To provide with a place to stay.",
    definition: "To provide with a place to stay or fit into.",
    example: "The new hotel can accommodate up to 500 guests at a time.",
    exampleTrans: "这家新酒店一次可容纳多达 500 位客人。",
    discrimination: "accommodate / adapt：accommodate 指提供住宿或容纳；adapt 指适应环境。",
    collocations: [{ phrase: "accommodate needs", meaning: "满足需求" }, { phrase: "accommodate guests", meaning: "招待客人" }], confusable: [{ word: "assess", meaning: "vt. 评估" }, { word: "excess", meaning: "n. 过量" }, { word: "process", meaning: "n. 过程" }] },
  { word: "accomplish", ipa: "/əˈkʌm.plɪʃ/", translation: "vt. 完成，实现",
    enDefinition: "vt. To succeed in doing something.",
    definition: "To succeed in doing or completing something.",
    example: "She accomplished her goal of running a marathon before age 40.",
    exampleTrans: "她实现了在 40 岁前跑完马拉松的目标。",
    discrimination: "accomplish / achieve / complete：accomplish 强调成功完成；achieve 侧重经努力达到；complete 侧重补齐全过程。",
    collocations: [{ phrase: "accomplish a task", meaning: "完成任务" }, { phrase: "accomplish a goal", meaning: "实现目标" }], confusable: [{ word: "accumulate", meaning: "v. 积累" }, { word: "accomplish", meaning: "vt. 完成" }, { word: "activate", meaning: "vt. 激活" }] },
  { word: "accurate", ipa: "/ˈæk.jər.ət/", translation: "a. 准确的，精确的",
    enDefinition: "adj. Correct and true in every detail.",
    definition: "Correct and true in every detail.",
    example: "The witness gave an accurate description of the suspect to the police.",
    exampleTrans: "目击者向警方准确地描述了嫌疑人的样子。",
    discrimination: "accurate / exact / precise：accurate 侧重符合事实；exact 侧重丝毫不差；precise 侧重明确精确。",
    collocations: [{ phrase: "accurate information", meaning: "准确信息" }, { phrase: "be accurate in", meaning: "在…方面准确" }], confusable: [{ word: "accomplice", meaning: "n. 同谋" }, { word: "compliment", meaning: "n. 赞美" }, { word: "polish", meaning: "v. 擦亮" }] },
];

/** 4 个选项（3 个干扰 + 1 正确）。干扰项用 confusable 的 meaning，每个选项含 word + enDefinition。 */
function buildOptions(correctWord: string, lessonId: number, qIdx: number): { options: { id: number; text: string; isCorrect: boolean; word: string; enDefinition: string }[]; correctIndex: number } {
  const correct = MOCK_WORDS.find((w) => w.word === correctWord)! as any;
  const correctText = correct.translation.split("\n")[0].split(/[;；]/)[0].trim();

  // 干扰项：从该词的 confusable 取
  const distractors: { text: string; word: string; enDefinition: string }[] = [];
  for (const c of correct.confusable || []) {
    if (c.word && c.meaning) {
      distractors.push({ text: c.meaning, word: c.word, enDefinition: "" });
    }
    if (distractors.length >= 3) break;
  }
  // confusable 不足，从其他词补
  if (distractors.length < 3) {
    for (const w of MOCK_WORDS as any[]) {
      if (w.word === correctWord) continue;
      if (distractors.length >= 3) break;
      const t = w.translation.split("\n")[0].split(/[;；]/)[0].trim();
      if (t !== correctText && !distractors.some(d => d.text === t)) {
        distractors.push({ text: t, word: w.word, enDefinition: w.enDefinition || w.definition });
      }
    }
  }

  // 构建选项（正确 + 干扰）
  const allOptions = [
    { text: correctText, word: correctWord, enDefinition: correct.enDefinition || correct.definition, isCorrect: true },
    ...distractors.map(d => ({ ...d, isCorrect: false })),
  ];
  // 打乱
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = (i * 7) % (i + 1);
    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
  }
  const correctIndex = allOptions.findIndex(o => o.isCorrect);
  return {
    options: allOptions.map((o, idx) => ({ id: lessonId * 1000 + qIdx * 10 + idx, ...o })),
    correctIndex,
  };
}

/** 关卡详情：10 题，按 lessonId 轮转取词。 */
export function getMockLessonDetail(lessonId: number) {
  const challenges = [];
  for (let i = 0; i < 10; i++) {
    const w = MOCK_WORDS[(lessonId * 10 + i) % MOCK_WORDS.length] as any;
    const { options, correctIndex } = buildOptions(w.word, lessonId, i);
    challenges.push({
      id: lessonId * 100 + i,
      challengeId: lessonId * 100 + i,
      type: "SELECT_CN",
      question: `${w.word} 的中文意思是？`,
      options: options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, word: o.word, enDefinition: o.enDefinition || null })),
      card: {
        word: w.word,
        phonetic: w.ipa,
        translation: w.translation,
        example: w.example,
        examples: [{ text: w.example, translation: w.exampleTrans, ref: null }],
        audioUrl: null,
        tags: ["演示"],
        difficulty: 3,
        definitions: [{ pos: w.translation.split(/[.；]/)[0] || "n.", gloss: w.definition }],
        etymology: null,
        forms: null,
        synonyms: null,
        antonyms: null,
        related: null,
        frequency: null,
        discrimination: w.discrimination,
        collocations: w.collocations,
        confusable: [],
      },
    });
  }
  return {
    id: lessonId,
    title: `关卡 ${lessonId % 10 || 10}`,
    description: null,
    questions: challenges,
  };
}

// ===========================================
// 复习队列
// ===========================================

export function getMockReviewQueue() {
  const cards = MOCK_WORDS.slice(0, 8).map((w, i) => ({
    card: {
      id: `demo-card-${i}`,
      word: w.word,
      phonetic: w.ipa,
      translation: w.translation,
      example: w.example,
      audioUrl: null,
      tags: ["演示"],
      difficulty: 3,
      definitions: [{ pos: "n.", gloss: w.definition }],
      examples: [{ text: w.example, translation: w.exampleTrans, ref: null }],
      etymology: null,
      forms: null,
      synonyms: null,
      antonyms: null,
      related: null,
      frequency: null,
      discrimination: w.discrimination,
      collocations: w.collocations,
    },
    progress: i < 3
      ? { fsrsDueDate: new Date(Date.now() - 3600000).toISOString(), totalReviews: 2, totalCorrect: 1 }
      : null,
  }));
  return {
    cards,
    userId: "demo-user",
    totalCards: cards.length,
    dueCards: 3,
    newCards: 5,
  };
}

/** 评分后返回（演示：永远成功，nextReview 1天后）。 */
export function getMockReviewResult(rating: number) {
  const intervalDays = rating === 0 ? 1 / 1440 : rating === 2 ? 1 : 3;
  const nextReview = new Date(Date.now() + intervalDays * 86400000).toISOString();
  return {
    success: true,
    nextReview,
    interval: Math.round(intervalDays),
    stability: 1.0,
    difficulty: 5,
  };
}

// ===========================================
// 找词游戏
// ===========================================

export function getMockWordSearchWords(bookId: number, limit = 8) {
  // 按 bookId 轮转取词
  const start = bookId % MOCK_WORDS.length;
  const picked: { word: string; translation: string }[] = [];
  for (let i = 0; i < limit; i++) {
    const w = MOCK_WORDS[(start + i) % MOCK_WORDS.length];
    picked.push({
      word: w.word.length <= 7 ? w.word : w.word.slice(0, 7),
      translation: w.translation.split("\n")[0].split(/[;；]/)[0].trim(),
    });
  }
  return picked;
}

// ===========================================
// 用户设置 / 统计
// ===========================================

export const MOCK_USER_SETTINGS = {
  userId: "demo-user",
  dailyGoalLessons: 5,
  dailyGoalMinutes: 15,
};

export const MOCK_TODAY_COMPLETED = 2;

// ===========================================
// PK 演示数据
// ===========================================

const PK_QUESTIONS = MOCK_WORDS.slice(0, 10).map((w: any, i) => {
  const correctText = w.translation.split("\n")[0].split(/[;；]/)[0].trim();
  // 干扰项用 confusable 的 meaning
  const distractors: { text: string; word: string; enDefinition: string }[] = [];
  for (const c of w.confusable || []) {
    if (c.word && c.meaning) distractors.push({ text: c.meaning, word: c.word, enDefinition: "" });
    if (distractors.length >= 3) break;
  }
  // 不足从其他词补
  if (distractors.length < 3) {
    for (const x of MOCK_WORDS as any[]) {
      if (x.word === w.word) continue;
      if (distractors.length >= 3) break;
      const t = x.translation.split("\n")[0].split(/[;；]/)[0].trim();
      if (t !== correctText && !distractors.some(d => d.text === t)) {
        distractors.push({ text: t, word: x.word, enDefinition: x.enDefinition || x.definition });
      }
    }
  }
  const allOpts = [
    { text: correctText, word: w.word, enDefinition: w.enDefinition || w.definition },
    ...distractors,
  ];
  for (let k = allOpts.length - 1; k > 0; k--) {
    const j = (k * 7) % (k + 1);
    [allOpts[k], allOpts[j]] = [allOpts[j], allOpts[k]];
  }
  const correctIndex = allOpts.findIndex(o => o.text === correctText);
  return {
    id: `demo-q-${i}`,
    questionIndex: i,
    question: w.word,
    options: allOpts.map(o => o.text),
    optionDetails: allOpts,
    correctIndex,
  };
});

const DEMO_ROOM_ID = "demo-room-0001";
const DEMO_ROOM_CODE = "DEMO01";

export function getMockNpcStart() {
  return {
    success: true,
    room: { id: DEMO_ROOM_ID, roomCode: DEMO_ROOM_CODE, type: "npc", status: "playing", bookId: null, questionCount: 10, timePerQuestion: 10, startedAt: new Date().toISOString() },
    npcUserId: "demo-npc",
    npcName: "NPC 小词",
    questions: PK_QUESTIONS,
  };
}

export function getMockNpcSubmitAnswer(rating: number) {
  const correct = rating >= 2;
  const tpMs = 10000;
  const timeLeft = tpMs - 2500;
  const userScore = correct ? Math.max(0, Math.min(100, Math.round((timeLeft / tpMs) * 100))) : -10;
  const npcCorrect = Math.random() < 0.75;
  const npcScore = npcCorrect ? 70 : -10;
  return {
    success: true,
    user: { isCorrect: correct, score: userScore, timeSpent: 2500 },
    npc: { isCorrect: npcCorrect, score: npcScore, timeSpent: 2700 },
    correctIndex: 0,
  };
}

export function getMockCreateRoom(userId: string) {
  return {
    success: true,
    room: { id: DEMO_ROOM_ID, roomCode: DEMO_ROOM_CODE, type: "friend", status: "waiting", bookId: null, questionCount: 10, timePerQuestion: 10, startedAt: null },
  };
}

export function getMockJoinRoom() {
  return {
    success: true,
    room: { id: DEMO_ROOM_ID, roomCode: DEMO_ROOM_CODE, type: "friend", status: "ready", bookId: null, questionCount: 10, timePerQuestion: 10, startedAt: null },
  };
}

export function getMockStartGame() {
  return { success: true, questions: PK_QUESTIONS };
}

export function getMockSubmitAnswer(rating: number) {
  const correct = rating >= 2;
  return { success: true, isCorrect: correct, score: correct ? 75 : -10 };
}

export function getMockRoom() {
  return {
    id: DEMO_ROOM_ID,
    roomCode: DEMO_ROOM_CODE,
    type: "friend",
    status: "waiting",
    bookId: null,
    questionCount: 10,
    timePerQuestion: 10,
    startedAt: null,
    users: [
      { userId: "demo-user", isHost: true, totalScore: 0, correctCount: 0 },
    ],
    questions: PK_QUESTIONS,
  };
}

export function getMockRoomAnswers() {
  return [];
}
