import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface UserStats {
  totalXP: number;
  currentHearts: number;
  maxHearts: number;
  powerWordRank: number;
  totalGamesPlayed: number;
  gamesWon: number;
  wordsLearned: number;
  streakDays: number;
}

interface UserStore {
  user: User | null;
  stats: UserStats | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setStats: (stats: UserStats | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateStats: (updates: Partial<UserStats>) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  stats: null,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setStats: (stats) => set({ stats }),
  logout: () => set({ user: null, stats: null, isAuthenticated: false }),
  setLoading: (isLoading) => set({ isLoading }),

  updateStats: (updates) => set((state) => ({
    stats: state.stats ? { ...state.stats, ...updates } : null
  })),
}));