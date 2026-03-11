/**
 * Token Manager
 * Manages auth status checking for agents. Tokens are stored server-side only.
 */

import type { OidcConfig, AuthStatus } from '../../types/index.ts';
import { getTokenInfo, getAllTokenInfo, refreshToken as backendRefresh, clearToken as backendClear } from './backendTokenStore.ts';
import { authenticateWithPopup } from './pkceAuth.ts';

export class TokenManager {
  /**
   * Check auth status for a single agent
   */
  async checkAuthStatus(agentId: string): Promise<AuthStatus> {
    try {
      const info = await getTokenInfo(agentId);
      if (!info.hasToken) return 'disconnected';
      if (info.isExpired) return 'disconnected';
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  /**
   * Check auth statuses for all agents at once
   */
  async checkAllAuthStatuses(): Promise<Record<string, AuthStatus>> {
    try {
      const { agents } = await getAllTokenInfo();
      const result: Record<string, AuthStatus> = {};
      for (const [agentId, info] of Object.entries(agents)) {
        if (!info.hasToken || info.isExpired) {
          result[agentId] = 'disconnected';
        } else {
          result[agentId] = 'connected';
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Authenticate an agent via PKCE popup flow
   */
  async authenticate(agentId: string, agentUrl: string, config: OidcConfig): Promise<void> {
    await authenticateWithPopup(agentId, agentUrl, config.issuerUrl, config.clientId, config.scopes, config.clientSecret, config.audience);
  }

  /**
   * Refresh token for an agent via the proxy
   */
  async refreshToken(agentId: string): Promise<boolean> {
    try {
      const result = await backendRefresh(agentId);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Clear token for an agent
   */
  async clearToken(agentId: string): Promise<void> {
    try {
      await backendClear(agentId);
    } catch (error) {
      console.error('[TokenManager] Failed to clear token:', error);
    }
  }
}

// Singleton instance
export const tokenManager = new TokenManager();
