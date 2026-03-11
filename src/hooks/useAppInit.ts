import { useEffect } from 'react';
import { useAgentStore } from '../store/agentStore.ts';
import { tokenManager } from '../services/auth/tokenManager.ts';
import type { AuthStatus } from '../types/index.ts';

/**
 * Initializes auth statuses for all configured agents on app startup.
 * For agents with OIDC config, checks the proxy for stored tokens and refreshes if expired.
 */
export function useAppInit() {
  const agents = useAgentStore((s) => s.agents);
  const setAllAuthStatuses = useAgentStore((s) => s.setAllAuthStatuses);
  const setAuthStatus = useAgentStore((s) => s.setAuthStatus);

  useEffect(() => {
    const agentsWithAuth = agents.filter((a) => a.auth?.clientId);
    if (agentsWithAuth.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        // Batch check all statuses at once
        const serverStatuses = await tokenManager.checkAllAuthStatuses();

        if (cancelled) return;

        const finalStatuses: Record<string, AuthStatus> = {};

        for (const agent of agentsWithAuth) {
          const serverStatus = serverStatuses[agent.id];

          if (!serverStatus || serverStatus === 'disconnected') {
            // Check if we can auto-refresh
            const refreshed = await tokenManager.refreshToken(agent.id);
            finalStatuses[agent.id] = refreshed ? 'connected' : 'disconnected';
          } else {
            finalStatuses[agent.id] = serverStatus;
          }
        }

        if (!cancelled) {
          setAllAuthStatuses(finalStatuses);
        }
      } catch (error) {
        console.error('[useAppInit] Failed to check auth statuses:', error);
        // Mark all auth agents as disconnected on failure
        if (!cancelled) {
          const failedStatuses: Record<string, AuthStatus> = {};
          for (const agent of agentsWithAuth) {
            failedStatuses[agent.id] = 'disconnected';
          }
          setAllAuthStatuses(failedStatuses);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agents, setAllAuthStatuses, setAuthStatus]);
}
