import { useCallback } from 'react';
import { tokenManager } from '../services/auth/tokenManager.ts';
import type { OidcConfig } from '../types/index.ts';

export function useAuth() {
  const getToken = useCallback(
    async (agentId: string, oidcConfig?: OidcConfig): Promise<string | null> => {
      if (!oidcConfig?.clientId || !oidcConfig.clientSecret) {
        return null;
      }
      return tokenManager.getToken(agentId, oidcConfig);
    },
    [],
  );

  const clearToken = useCallback((agentId: string) => {
    tokenManager.clearToken(agentId);
  }, []);

  return { getToken, clearToken };
}
