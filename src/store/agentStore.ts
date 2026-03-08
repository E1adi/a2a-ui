import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig } from '../types/index.ts';

interface AgentState {
  agents: AgentConfig[];
  selectedAgentId: string | null;
  addAgent: (agent: AgentConfig) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  selectAgent: (id: string | null) => void;
  getAgent: (id: string) => AgentConfig | undefined;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      selectedAgentId: null,

      addAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),

      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
        })),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      selectAgent: (id) => set({ selectedAgentId: id }),

      getAgent: (id) => get().agents.find((a) => a.id === id),
    }),
    {
      name: 'a2a-agents',
      partialize: (state) => ({
        agents: state.agents.map((a) => ({
          ...a,
          auth: a.auth ? { ...a.auth, clientSecret: undefined } : undefined,
        })),
        selectedAgentId: state.selectedAgentId,
      }),
    },
  ),
);
