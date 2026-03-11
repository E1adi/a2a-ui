import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig, AuthStatus } from '../types/index.ts';

interface AgentState {
  agents: AgentConfig[];
  selectedAgentId: string | null;
  authStatuses: Record<string, AuthStatus>;
  addAgent: (agent: AgentConfig) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  selectAgent: (id: string | null) => void;
  getAgent: (id: string) => AgentConfig | undefined;
  setAuthStatus: (agentId: string, status: AuthStatus) => void;
  setAllAuthStatuses: (statuses: Record<string, AuthStatus>) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      selectedAgentId: null,
      authStatuses: {},

      addAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),

      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
          authStatuses: (() => {
            const { [id]: _, ...rest } = state.authStatuses;
            return rest;
          })(),
        })),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      selectAgent: (id) => set({ selectedAgentId: id }),

      getAgent: (id) => get().agents.find((a) => a.id === id),

      setAuthStatus: (agentId, status) =>
        set((state) => ({
          authStatuses: { ...state.authStatuses, [agentId]: status },
        })),

      setAllAuthStatuses: (statuses) =>
        set((state) => ({
          authStatuses: { ...state.authStatuses, ...statuses },
        })),
    }),
    {
      name: 'a2a-agents',
      partialize: (state) => ({
        agents: state.agents.map((a) => ({
          ...a,
          // Strip clientSecret from localStorage — it's stored server-side in SQLite
          auth: a.auth ? { ...a.auth, clientSecret: undefined } : undefined,
        })),
        selectedAgentId: state.selectedAgentId,
        // authStatuses is NOT persisted — ephemeral, checked from backend on load
      }),
    },
  ),
);
