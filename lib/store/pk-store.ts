import { create } from 'zustand';

interface PKRoom {
  id: string;
  roomCode: string;
  type: string;
  status: string;
  questionCount: number;
  timePerQuestion: number;
}

interface PKUser {
  id: string;
  name: string;
  avatarUrl?: string;
  isHost: boolean;
  totalScore: number;
  correctCount: number;
}

interface PKQuestion {
  id: string;
  questionIndex: number;
  question: string;
  options: string[];
  correctIndex: number;
}

interface PKStore {
  // 房间状态
  currentRoom: PKRoom | null;
  roomUsers: PKUser[];
  currentQuestion: PKQuestion | null;
  questionIndex: number;

  // 对战状态
  isMatching: boolean;
  isPlaying: boolean;
  myUserId: string | null;

  // 动作
  setCurrentRoom: (room: PKRoom | null) => void;
  setRoomUsers: (users: PKUser[]) => void;
  setCurrentQuestion: (question: PKQuestion | null) => void;
  setQuestionIndex: (index: number) => void;
  setMatching: (isMatching: boolean) => void;
  setPlaying: (isPlaying: boolean) => void;
  setMyUserId: (userId: string | null) => void;
  updateRoomUserScore: (userId: string, score: number, correctCount: number) => void;
  reset: () => void;
}

export const usePKStore = create<PKStore>((set) => ({
  currentRoom: null,
  roomUsers: [],
  currentQuestion: null,
  questionIndex: 0,
  isMatching: false,
  isPlaying: false,
  myUserId: null,

  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setRoomUsers: (roomUsers) => set({ roomUsers }),
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
  setQuestionIndex: (questionIndex) => set({ questionIndex }),
  setMatching: (isMatching) => set({ isMatching }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setMyUserId: (myUserId) => set({ myUserId }),

  updateRoomUserScore: (userId, score, correctCount) => set((state) => ({
    roomUsers: state.roomUsers.map(user =>
      user.id === userId
        ? { ...user, totalScore: score, correctCount }
        : user
    )
  })),

  reset: () => set({
    currentRoom: null,
    roomUsers: [],
    currentQuestion: null,
    questionIndex: 0,
    isMatching: false,
    isPlaying: false,
  }),
}));
