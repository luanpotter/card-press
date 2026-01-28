import type { Card, Session } from "@/types/session";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  addSession: (session: Omit<Session, "id" | "cards">) => string;
  updateSession: (id: string, session: Partial<Omit<Session, "id" | "cards">>) => void;
  deleteSession: (id: string) => void;
  deleteAllSessions: () => void;
  setActiveSession: (id: string) => void;
  getActiveSession: () => Session | undefined;
  // Card operations
  addCard: (sessionId: string, card: Omit<Card, "id">) => string;
  updateCard: (sessionId: string, cardId: string, card: Partial<Omit<Card, "id">>) => void;
  deleteCard: (sessionId: string, cardId: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      addSession: (session) => {
        const id = crypto.randomUUID();
        set((state) => {
          const newSessions = [...state.sessions, { ...session, id, cards: [] }];
          // If this is the first session, make it active
          const activeId = state.activeSessionId ?? id;
          return { sessions: newSessions, activeSessionId: activeId };
        });
        return id;
      },
      updateSession: (id, session) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...session } : s)),
        })),
      deleteSession: (id) =>
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          // If deleting the active, pick the first remaining or null
          const newActive = state.activeSessionId === id ? (newSessions[0]?.id ?? null) : state.activeSessionId;
          return { sessions: newSessions, activeSessionId: newActive };
        }),
      deleteAllSessions: () => set({ sessions: [], activeSessionId: null }),
      setActiveSession: (id) => {
        const { sessions } = get();
        if (sessions.some((s) => s.id === id)) {
          set({ activeSessionId: id });
        }
      },
      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId);
      },
      // Card operations
      addCard: (sessionId, card) => {
        const cardId = crypto.randomUUID();
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, cards: [...s.cards, { ...card, id: cardId }] } : s
          ),
        }));
        return cardId;
      },
      updateCard: (sessionId, cardId, card) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...card } : c)) } : s
          ),
        })),
      deleteCard: (sessionId, cardId) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, cards: s.cards.filter((c) => c.id !== cardId) } : s
          ),
        })),
    }),
    { name: "card-press-sessions" }
  )
);
