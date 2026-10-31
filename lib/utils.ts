import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return '刚刚';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}个月前`;
  return `${Math.floor(diffInSeconds / 31536000)}年前`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function calculateTimeLeft(deadline: Date): { text: string; percentage: number; isExpired: boolean } {
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const totalMs = 10 * 1000; // 10秒总时间

  if (diffMs <= 0) {
    return { text: '0.0s', percentage: 0, isExpired: true };
  }

  const secondsLeft = Math.ceil(diffMs / 1000);
  const percentage = Math.max(0, Math.min(100, (diffMs / totalMs) * 100));

  return {
    text: `${secondsLeft.toFixed(1)}s`,
    percentage,
    isExpired: false
  };
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function calculatePKScore(timeLeft: number, totalTime: number): number {
  const speedBonus = (timeLeft / totalTime) * 100; // 速度奖励
  return Math.max(0, Math.min(100, Math.round(speedBonus)));
}

export function calculatePowerWordRank(currentRank: number, won: boolean, opponentRank: number): number {
  const K = 32; // Elo等级分常数
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRank - currentRank) / 400));
  const actualScore = won ? 1 : 0;
  const newRank = currentRank + K * (actualScore - expectedScore);

  return Math.max(0, Math.round(newRank));
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码至少需要8个字符' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码需要包含大写字母' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码需要包含小写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需要包含数字' };
  }
  return { valid: true, message: '' };
}
