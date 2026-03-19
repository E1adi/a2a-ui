import type { AgentCard, Message, Task, TaskState, Artifact } from '../services/a2a/types.ts';

export interface OidcConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string;
  audience?: string;
}

export type AuthStatus = 'connected' | 'disconnected' | 'none';

export interface AgentConfig {
  id: string;
  agentUrl: string;
  displayName?: string;
  agentCard?: AgentCard;
  auth?: OidcConfig;
  useProxy?: boolean;
  createdAt: number;
}

export interface ChatMessage extends Message {
  status: 'sending' | 'sent' | 'streaming' | 'processing' | 'error';
  streamingContent?: string;
  timestamp: number;
  error?: string;
}

export interface Conversation {
  id: string;
  contextId?: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
  tasks: Task[];
  artifacts: Artifact[];
  lastTaskState?: TaskState;
  currentStatus?: string; // Current status update text (e.g., "Processing...")
  createdAt: number;
  updatedAt: number;
}
