import type { JsonRpcError } from '../services/a2a/types.ts';

export class A2AHttpError extends Error {
  status: number;
  statusText: string;

  constructor(status: number, statusText: string, message?: string) {
    super(message ?? `HTTP ${status}: ${statusText}`);
    this.name = 'A2AHttpError';
    this.status = status;
    this.statusText = statusText;
  }
}

export class A2AJsonRpcError extends Error {
  rpcError: JsonRpcError;

  constructor(rpcError: JsonRpcError) {
    super(`JSON-RPC Error ${rpcError.code}: ${rpcError.message}`);
    this.name = 'A2AJsonRpcError';
    this.rpcError = rpcError;
  }
}

export class A2AStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'A2AStreamError';
  }
}

export class OidcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcError';
  }
}
