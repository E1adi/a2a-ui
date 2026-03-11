import { useCallback } from 'react';
import { tokenManager } from '../services/auth/tokenManager.ts';
import { useAgentStore } from '../store/agentStore.ts';
import type { OidcConfig, AuthStatus } from '../types/index.ts';

export function useAuth() {
  const setAuthStatus = useAgentStore((s) => s.setAuthStatus);

  const authenticate = useCallback(
    async (agentId: string, agentUrl: string, oidcConfig: OidcConfig): Promise<void> => {
      await tokenManager.authenticate(agentId, agentUrl, oidcConfig);
      setAuthStatus(agentId, 'connected');
    },
    [setAuthStatus],
  );

  const refreshToken = useCallback(
    async (agentId: string): Promise<boolean> => {
      const success = await tokenManager.refreshToken(agentId);
      setAuthStatus(agentId, success ? 'connected' : 'disconnected');
      return success;
    },
    [setAuthStatus],
  );

  const clearToken = useCallback(
    async (agentId: string): Promise<void> => {
      await tokenManager.clearToken(agentId);
      setAuthStatus(agentId, 'none');
    },
    [setAuthStatus],
  );

  const checkStatus = useCallback(
    async (agentId: string): Promise<AuthStatus> => {
      const status = await tokenManager.checkAuthStatus(agentId);
      setAuthStatus(agentId, status);
      return status;
    },
    [setAuthStatus],
  );

  return { authenticate, refreshToken, clearToken, checkStatus };
}
