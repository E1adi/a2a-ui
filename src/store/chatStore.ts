import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, Conversation } from '../types/index.ts';
import type { Artifact, Task, TaskState } from '../services/a2a/types.ts';

interface ChatState {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
  conversationsByAgent: Record<string, string[]>;
  activeStreams: Record<string, AbortController>;

  createConversation: (agentId: string, title?: string) => Conversation;
  deleteConversation: (conversationId: string) => void;
  deleteAllConversationsForAgent: (agentId: string) => void;
  selectConversation: (conversationId: string) => void;
  getConversation: (conversationId: string) => Conversation | undefined;
  getSelectedConversation: () => Conversation | undefined;
  getConversationsForAgent: (agentId: string) => Conversation[];
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  appendStreamingContent: (conversationId: string, messageId: string, content: string) => void;
  addTask: (conversationId: string, task: Task) => void;
  updateTaskState: (conversationId: string, taskId: string, state: TaskState) => void;
  setContextId: (conversationId: string, contextId: string) => void;
  addArtifact: (conversationId: string, artifact: Artifact) => void;
  setCurrentStatus: (conversationId: string, status: string) => void;
  clearCurrentStatus: (conversationId: string) => void;
  setActiveStream: (conversationId: string, controller: AbortController) => void;
  clearActiveStream: (conversationId: string) => void;
  cancelStream: (conversationId: string) => void;
}

const createEmptyConversation = (agentId: string, title?: string): Conversation => ({
  id: uuidv4(),
  agentId,
  title: title ?? `Conversation ${new Date().toLocaleString()}`,
  messages: [],
  tasks: [],
  artifacts: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: {},
      selectedConversationId: null,
      conversationsByAgent: {},
      activeStreams: {},

      createConversation: (agentId, title) => {
        const newConv = createEmptyConversation(agentId, title);
        set((state) => ({
          conversations: {
            ...state.conversations,
            [newConv.id]: newConv,
          },
          conversationsByAgent: {
            ...state.conversationsByAgent,
            [agentId]: [...(state.conversationsByAgent[agentId] ?? []), newConv.id],
          },
          selectedConversationId: newConv.id,
        }));
        return newConv;
      },

      deleteConversation: (conversationId) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;

          const { [conversationId]: _, ...remainingConvs } = state.conversations;
          const agentConvs = state.conversationsByAgent[conv.agentId] ?? [];
          const updatedAgentConvs = agentConvs.filter((id) => id !== conversationId);

          return {
            conversations: remainingConvs,
            conversationsByAgent: {
              ...state.conversationsByAgent,
              [conv.agentId]: updatedAgentConvs,
            },
            selectedConversationId:
              state.selectedConversationId === conversationId ? null : state.selectedConversationId,
          };
        });
      },

      deleteAllConversationsForAgent: (agentId) => {
        set((state) => {
          const convIds = state.conversationsByAgent[agentId] ?? [];
          const remainingConvs = { ...state.conversations };

          for (const convId of convIds) {
            delete remainingConvs[convId];
          }

          const { [agentId]: _, ...remainingAgentConvs } = state.conversationsByAgent;
          const shouldClearSelection = convIds.includes(state.selectedConversationId ?? '');

          return {
            conversations: remainingConvs,
            conversationsByAgent: remainingAgentConvs,
            selectedConversationId: shouldClearSelection ? null : state.selectedConversationId,
          };
        });
      },

      selectConversation: (conversationId) => set({ selectedConversationId: conversationId }),

      getConversation: (conversationId) => get().conversations[conversationId],

      getSelectedConversation: () => {
        const { selectedConversationId, conversations } = get();
        return selectedConversationId ? conversations[selectedConversationId] : undefined;
      },

      getConversationsForAgent: (agentId) => {
        const { conversationsByAgent, conversations } = get();
        const convIds = conversationsByAgent[agentId] ?? [];
        return convIds
          .map((id) => conversations[id])
          .filter(Boolean)
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },

      addMessage: (conversationId, message) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: [...conv.messages, message],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateMessage: (conversationId, messageId, updates) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.messageId === messageId ? { ...m, ...updates } : m,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      appendStreamingContent: (conversationId, messageId, content) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.messageId === messageId
                    ? { ...m, streamingContent: (m.streamingContent ?? '') + content }
                    : m,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      addTask: (conversationId, task) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          const existing = conv.tasks.findIndex((t) => t.id === task.id);
          const tasks = existing >= 0
            ? conv.tasks.map((t) => (t.id === task.id ? task : t))
            : [...conv.tasks, task];
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                tasks,
                lastTaskState: task.status.state,
                contextId: task.contextId,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateTaskState: (conversationId, taskId, state) => {
        set((prevState) => {
          const conv = prevState.conversations[conversationId];
          if (!conv) return prevState;
          return {
            conversations: {
              ...prevState.conversations,
              [conversationId]: {
                ...conv,
                tasks: conv.tasks.map((t) =>
                  t.id === taskId ? { ...t, status: { ...t.status, state } } : t,
                ),
                lastTaskState: state,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      setContextId: (conversationId, contextId) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: { ...conv, contextId, updatedAt: Date.now() },
            },
          };
        });
      },

      addArtifact: (conversationId, artifact) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          const existing = conv.artifacts.findIndex((a) => a.artifactId === artifact.artifactId);
          const artifacts = existing >= 0
            ? conv.artifacts.map((a) => (a.artifactId === artifact.artifactId ? artifact : a))
            : [...conv.artifacts, artifact];
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: { ...conv, artifacts, updatedAt: Date.now() },
            },
          };
        });
      },

      setCurrentStatus: (conversationId, status) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: { ...conv, currentStatus: status, updatedAt: Date.now() },
            },
          };
        });
      },

      clearCurrentStatus: (conversationId) => {
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: { ...conv, currentStatus: undefined, updatedAt: Date.now() },
            },
          };
        });
      },

      setActiveStream: (conversationId, controller) =>
        set((state) => ({
          activeStreams: { ...state.activeStreams, [conversationId]: controller },
        })),

      clearActiveStream: (conversationId) =>
        set((state) => {
          const { [conversationId]: _, ...rest } = state.activeStreams;
          return { activeStreams: rest };
        }),

      cancelStream: (conversationId) => {
        const controller = get().activeStreams[conversationId];
        if (controller) {
          controller.abort();
          get().clearActiveStream(conversationId);
          get().clearCurrentStatus(conversationId);
        }
      },
    }),
    {
      name: 'a2a-chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        conversationsByAgent: state.conversationsByAgent,
        selectedConversationId: state.selectedConversationId,
      }),
    },
  ),
);
