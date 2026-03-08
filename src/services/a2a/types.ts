// A2A Protocol Types (v0.3.0)

// --- Task States ---
export type TaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'auth-required'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'rejected';

// --- Parts (discriminated union on `kind`) ---
export interface TextPart {
  kind: 'text';
  text: string;
  metadata?: Record<string, unknown>;
}

export interface FilePart {
  kind: 'file';
  file: {
    url?: string;
    bytes?: string; // base64
    name?: string;
    mimeType?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface DataPart {
  kind: 'data';
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type Part = TextPart | FilePart | DataPart;

// --- Messages ---
export interface Message {
  messageId: string;
  role: 'user' | 'agent';
  parts: Part[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  metadata?: Record<string, unknown>;
}

// --- Task ---
export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string;
}

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: string;
  contextId: string;
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
  metadata?: Record<string, unknown>;
}

// --- Agent Card ---
export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  extendedAgentCard?: boolean;
}

export interface AgentProvider {
  organization: string;
  url?: string;
}

export interface AgentCard {
  name: string;
  description?: string;
  url: string;
  version?: string;
  provider?: AgentProvider;
  capabilities?: AgentCapabilities;
  skills?: AgentSkill[];
  securitySchemes?: Record<string, unknown>;
  security?: Record<string, string[]>[];
}

// --- JSON-RPC 2.0 ---
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: JsonRpcError;
}

// --- SendMessage ---
export interface SendMessageConfiguration {
  acceptedOutputModes?: string[];
  blocking?: boolean;
  historyLength?: number;
  pushNotificationConfig?: Record<string, unknown>;
}

export interface SendMessageParams {
  message: Message;
  configuration?: SendMessageConfiguration;
}

// --- Streaming Events ---
export interface TaskStatusUpdateEvent {
  taskId: string;
  contextId: string;
  status: TaskStatus;
  final: boolean;
}

export interface TaskArtifactUpdateEvent {
  taskId: string;
  contextId: string;
  artifact: Artifact;
}

// Actual A2A streaming format uses discriminated unions with 'kind' property
export type StreamResponse =
  | { kind: 'task'; id: string; contextId?: string; status: TaskStatus; history?: Message[] }
  | { kind: 'message'; message: Message }
  | { kind: 'status-update'; taskId: string; contextId?: string; status: TaskStatus; final: boolean }
  | { kind: 'artifact-update'; taskId: string; contextId?: string; artifact: Artifact }
  // Legacy format (kept for compatibility)
  | { task: Task }
  | { message: Message }
  | { statusUpdate: TaskStatusUpdateEvent }
  | { artifactUpdate: TaskArtifactUpdateEvent };
