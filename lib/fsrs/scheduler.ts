import {
  FSRSRating,
  FSRSCardState,
  FSRSCard,
  FSRSParams,
  FSRSSchedulingResult,
  FSRSReviewLog
} from "./types";

// FSRS-6默认权重参数
const DEFAULT_WEIGHTS = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14,
  0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
];

// FSRS默认参数
const DEFAULT_PARAMS: FSRSParams = {
  requestRetention: 0.9,
  maximumInterval: 36500, // 100年
  w: DEFAULT_WEIGHTS,
  enableFuzz: true,
  learningSteps: [1, 10], // 1分钟, 10分钟
  relearningSteps: [10], // 10分钟
};

// 常量
const DECAY = -DEFAULT_WEIGHTS[20];
const FACTOR = Math.exp(Math.log(0.9) / DECAY) - 1;

export class FSRSScheduler {
  private params: FSRSParams;

  constructor(params: Partial<FSRSParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  /**
   * 计算下一个复习时间
   */
  schedule(card: FSRSCard, rating: FSRSRating, timeTaken: number = 0): FSRSSchedulingResult {
    const now = new Date();
    const previousState = card.state;
    let state = previousState;
    let stability = card.stability;
    let difficulty = card.difficulty;

    // 根据当前状态和评分更新状态和参数
    if (previousState === "new") {
      // 新卡片第一次复习
      if (rating === 0) {
        state = "learning";
        stability = this.calculateInitialStability(rating, difficulty);
      } else if (rating === 1) {
        state = "learning";
        stability = this.calculateInitialStability(rating, difficulty);
      } else if (rating === 2) {
        state = "learning";
        stability = this.calculateInitialStability(rating, difficulty);
      } else if (rating === 3) {
        state = "review";
        stability = this.calculateInitialStability(rating, difficulty);
      }
    } else if (previousState === "learning") {
      // 学习状态
      if (rating === 0) {
        state = "learning";
        stability = this.calculateNextStability(stability, rating, difficulty);
      } else if (rating === 1) {
        state = "learning";
        stability = this.calculateNextStability(stability, rating, difficulty);
      } else if (rating === 2) {
        if (this.isLastStep(card)) {
          state = "review";
          stability = this.calculateNextStability(stability, rating, difficulty);
        } else {
          state = "learning";
          stability = this.calculateNextStability(stability, rating, difficulty);
        }
      } else if (rating === 3) {
        state = "review";
        stability = this.calculateNextStability(stability, rating, difficulty);
      }
    } else if (previousState === "review") {
      // 复习状态
      if (rating === 0) {
        state = "relearning";
        stability = this.calculateNextStability(stability, rating, difficulty);
      } else {
        state = "review";
        stability = this.calculateNextStability(stability, rating, difficulty);
      }
    } else if (previousState === "relearning") {
      // 重新学习状态
      if (rating === 0) {
        state = "relearning";
        stability = this.calculateNextStability(stability, rating, difficulty);
      } else if (rating === 1) {
        state = "relearning";
        stability = this.calculateNextStability(stability, rating, difficulty);
      } else if (rating === 2) {
        if (this.isLastStep(card)) {
          state = "review";
          stability = this.calculateNextStability(stability, rating, difficulty);
        } else {
          state = "relearning";
          stability = this.calculateNextStability(stability, rating, difficulty);
        }
      } else if (rating === 3) {
        state = "review";
        stability = this.calculateNextStability(stability, rating, difficulty);
      }
    }

    // 更新难度
    difficulty = this.calculateNextDifficulty(difficulty, rating);

    // 计算间隔
    let interval = 0;
    let dueDate: Date;

    if (state === "learning" || state === "relearning") {
      const steps = state === "learning" ? this.params.learningSteps : this.params.relearningSteps;
      const stepIndex = (card.stepIndex || 0) + 1;

      if (stepIndex < steps.length) {
        interval = steps[stepIndex] / (24 * 60); // 转换为天
        dueDate = new Date(now.getTime() + steps[stepIndex] * 60 * 1000); // 分钟转毫秒
      } else {
        state = "review";
        interval = this.calculateInterval(stability);
        dueDate = this.calculateDueDate(now, interval);
      }
    } else if (state === "review") {
      interval = this.calculateInterval(stability);
      dueDate = this.calculateDueDate(now, interval);
    } else {
      // new状态
      dueDate = now;
    }

    // 创建复习日志
    const reviewLog: FSRSReviewLog = {
      rating,
      state: previousState,
      due: dueDate,
      interval,
      stability,
      difficulty,
      timeTaken,
    };

    return {
      due: dueDate,
      interval,
      stability,
      difficulty,
      reviewLog
    };
  }

  /**
   * 计算初始稳定性
   */
  private calculateInitialStability(rating: FSRSRating, difficulty: number): number {
    const w = this.params.w;
    return Math.max(0.1, w[4] - (difficulty - 3) * (w[5] + rating * w[6]));
  }

  /**
   * 计算下一个稳定性
   */
  private calculateNextStability(stability: number, rating: FSRSRating, difficulty: number): number {
    const w = this.params.w;
    const easyBonus = rating === 3 ? w[15] : 0;
    const hardPenalty = rating === 1 ? w[16] : 0;

    const nextStability = stability * (
      Math.exp(w[8]) *
      (11 - difficulty) *
      w[9] *
      Math.exp(-hardPenalty) *
      (stability + 1) ** w[10]
    ) /
      (stability + easyBonus + 1);

    return Math.max(nextStability, 0.1);
  }

  /**
   * 计算下一个难度
   */
  private calculateNextDifficulty(difficulty: number, rating: FSRSRating): number {
    const w = this.params.w;
    const nextDifficulty = difficulty - w[17] * (rating - 2) + Math.random() * 0.1;

    return Math.max(1, Math.min(10, nextDifficulty));
  }

  /**
   * 计算间隔
   */
  private calculateInterval(stability: number): number {
    const w = this.params.w;
    const newInterval = stability * (
      Math.exp(w[7]) *
      (11 - this.params.requestRetention) ** w[9]
    );

    // 应用fuzz随机扰动
    if (this.params.enableFuzz) {
      return this.applyFuzz(newInterval);
    }

    return Math.min(newInterval, this.params.maximumInterval);
  }

  /**
   * 应用fuzz随机扰动
   */
  private applyFuzz(interval: number): number {
    const fuzzRange = this.getFuzzRange(interval);
    const fuzz = (Math.random() - 0.5) * 2 * fuzzRange;
    const fuzzedInterval = interval * (1 + fuzz);

    return Math.min(Math.max(fuzzedInterval, 0.1), this.params.maximumInterval);
  }

  /**
   * 获取fuzz范围
   */
  private getFuzzRange(interval: number): number {
    if (interval < 2.5) {
      return 0.15;
    } else if (interval < 7.0) {
      return 0.15;
    } else if (interval < 20.0) {
      return 0.10;
    } else {
      return 0.05;
    }
  }

  /**
   * 计算到期时间
   */
  private calculateDueDate(now: Date, interval: number): Date {
    const intervalMs = interval * 24 * 60 * 60 * 1000; // 天转毫秒
    return new Date(now.getTime() + intervalMs);
  }

  /**
   * 检查是否是最后一步
   */
  private isLastStep(card: FSRSCard): boolean {
    const steps = card.state === "learning" ? this.params.learningSteps : this.params.relearningSteps;
    return (card.stepIndex || 0) >= steps.length - 1;
  }

  /**
   * 获取默认参数
   */
  static getDefaults(): FSRSParams {
    return DEFAULT_PARAMS;
  }
}

// 导出默认调度器实例
export const defaultScheduler = new FSRSScheduler();
