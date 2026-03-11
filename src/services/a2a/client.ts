import { v4 as uuidv4 } from 'uuid';
import type {
  AgentCard,
  JsonRpcRequest,
  JsonRpcResponse,
  Message,
  SendMessageConfiguration,
  Task,
} from './types.ts';
import { A2AHttpError, A2AJsonRpcError } from '../../utils/errors.ts';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001/proxy';

export class A2AClient {
  private agentUrl: string;
  private useProxy: boolean;

  constructor(agentUrl: string, useProxy = true) {
    this.agentUrl = agentUrl;
    this.useProxy = useProxy;
  }

  static async discoverAgent(baseUrl: string, useProxy = true): Promise<AgentCard> {
    const base = baseUrl.replace(/\/+$/, '');
    // Try both well-known paths: agent.json (A2A v0.3+) and agent-card.json (legacy)
    const paths = ['/.well-known/agent.json', '/.well-known/agent-card.json'];

    let lastError: Error | null = null;
    for (const path of paths) {
      const url = base + path;
      try {
        if (useProxy) {
          const res = await fetch(PROXY_URL, {
            method: 'GET',
            headers: { 'X-Target-URL': url },
            credentials: 'include',
          });
          if (!res.ok) {
            lastError = new A2AHttpError(res.status, res.statusText, `Failed to discover agent at ${url}`);
            continue;
          }
          return res.json() as Promise<AgentCard>;
        } else {
          const res = await fetch(url);
          if (!res.ok) {
            lastError = new A2AHttpError(res.status, res.statusText, `Failed to discover agent at ${url}`);
            continue;
          }
          return res.json() as Promise<AgentCard>;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError ?? new Error(`Failed to discover agent at ${base}`);
  }

  async sendMessage(message: Message, config?: SendMessageConfiguration): Promise<Task> {
    return this.rpcCall<Task>('message/send', {
      message,
      configuration: config,
    });
  }

  async getTask(taskId: string): Promise<Task> {
    return this.rpcCall<Task>('tasks/get', { id: taskId });
  }

  async cancelTask(taskId: string): Promise<Task> {
    return this.rpcCall<Task>('tasks/cancel', { id: taskId });
  }

  private async rpcCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.useProxy) {
      headers['X-Target-URL'] = this.agentUrl;
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method,
      params,
    };

    const fetchUrl = this.useProxy ? PROXY_URL : this.agentUrl;

    const res = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      credentials: this.useProxy ? 'include' : 'omit',
    });

    if (!res.ok) {
      throw new A2AHttpError(res.status, res.statusText);
    }

    const json = (await res.json()) as JsonRpcResponse<T>;

    if (json.error) {
      throw new A2AJsonRpcError(json.error);
    }

    return json.result as T;
  }
}
