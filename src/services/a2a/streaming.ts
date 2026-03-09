import { v4 as uuidv4 } from 'uuid';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  Message,
  SendMessageConfiguration,
  StreamResponse,
} from './types.ts';
import { A2AHttpError, A2AStreamError } from '../../utils/errors.ts';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001/proxy';

export function sendStreamingMessage(
  agentUrl: string,
  message: Message,
  config: SendMessageConfiguration | undefined,
  token: string | null,
  onEvent: (event: StreamResponse) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
  useProxy = true,
  agentId?: string,
): AbortController {
  const controller = new AbortController();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };

  if (useProxy) {
    headers['X-Target-URL'] = agentUrl;
    if (agentId) {
      headers['X-Agent-ID'] = agentId;
    }
  }

  // Only include Authorization if not using proxy (proxy will inject it)
  if (!useProxy && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: uuidv4(),
    method: 'message/stream',
    params: {
      message,
      configuration: config,
    },
  };

  const fetchUrl = useProxy ? PROXY_URL : agentUrl;

  fetch(fetchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal: controller.signal,
    credentials: useProxy ? 'include' : 'omit', // Include cookies for proxy
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new A2AHttpError(res.status, res.statusText);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new A2AStreamError('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let dataBuffer = '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            dataBuffer += line.slice(5).trim();
          } else if (line.trim() === '' && dataBuffer) {
            try {
              const json = JSON.parse(dataBuffer) as JsonRpcResponse<StreamResponse>;
              if (json.error) {
                onError(new A2AStreamError(`JSON-RPC Error: ${json.error.message}`));
              } else if (json.result) {
                onEvent(json.result);
              }
            } catch {
              // Ignore malformed SSE data
            }
            dataBuffer = '';
          }
        }
      }

      onComplete();
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        onComplete();
        return;
      }
      onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}
