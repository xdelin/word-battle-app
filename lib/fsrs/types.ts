// FSRS算法相关类型定义

export type FSRSRating = 0 | 1 | 2 | 3; // Again, Hard, Good, Easy
export type FSRSCardState = "new" | "learning" | "review" | "relearning";

export interface FSRSReview {
  rating: FSRSRating;
  state: FSRSCardState;
  due: Date;
  interval: number; // 间隔天数
  stability: number;
  difficulty: number;
}

export interface FSRSCard {
  state: FSRSCardState;
  stability: number;
  difficulty: number;
  lastReviewedAt?: Date;
  scheduledDays: number;
  dueDate?: Date;
  stepIndex?: number;
  totalReviews: number;
  totalLapses: number;
  totalCorrect: number;
}

export interface FSRSParams {
  requestRetention: number; // 目标记忆保持率
  maximumInterval: number; // 最大间隔天数
  w: number[]; // FSRS权重参数
  enableFuzz: boolean; // 是否启用随机扰动
  learningSteps: number[]; // 学习步骤间隔(分钟)
  relearningSteps: number[]; // 重新学习步骤间隔(分钟)
}

export interface FSRSSchedulingResult {
  due: Date;
  interval: number;
  stability: number;
  difficulty: number;
  reviewLog: FSRSReviewLog;
}

export interface FSRSReviewLog {
  rating: FSRSRating;
  state: FSRSCardState;
  due: Date;
  interval: number;
  stability: number;
  difficulty: number;
  timeTaken: number;
}
