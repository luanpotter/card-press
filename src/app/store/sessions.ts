import type { Session } from "@/types/session";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  addSession: (session: Omit<Session, "id">) => string;
  updateSession: (id: string, session: Omit<Session, "id">) => void;
  deleteSession: (id: string) => void;
  deleteAllSessions: () => void;
  setActiveSession: (id: string) => void;
  getActiveSession: () => Session | undefined;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      addSession: (session) => {
        const id = crypto.randomUUID();
        set((state) => {
          const newSessions = [...state.sessions, { ...session, id }];
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
    }),
    { name: "card-press-sessions" }
  )
);
