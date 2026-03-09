import type { OidcConfig } from '../../types/index.ts';
import { OidcTokenService } from './oidc.ts';
import { storeToken, getTokenInfo, clearToken as clearBackendToken } from './backendTokenStore.ts';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000; // Refresh 60s before expiry

export class TokenManager {
  private cache = new Map<string, CachedToken>(); // In-memory cache for performance
  private pendingRefreshes = new Map<string, Promise<string>>();

  /**
   * Get token for an agent. Checks backend first, then refreshes if needed.
   */
  async getToken(agentId: string, oidcConfig: OidcConfig): Promise<string> {
    // Check in-memory cache first (fastest)
    const cached = this.cache.get(agentId);
    if (cached && cached.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
      return cached.accessToken;
    }

    // Check if token exists in backend
    try {
      const tokenInfo = await getTokenInfo(agentId);
      if (tokenInfo.hasToken && !tokenInfo.isExpired) {
        // Token exists and valid in backend, but we don't have it in memory
        // Need to fetch a new one (backend doesn't send tokens back for security)
        console.log('[TokenManager] Token exists in backend but not in memory, fetching new one');
      }
    } catch (error) {
      console.warn('[TokenManager] Failed to check backend token:', error);
    }

    // Deduplicate concurrent refresh calls
    const pending = this.pendingRefreshes.get(agentId);
    if (pending) return pending;

    const refreshPromise = this.refreshToken(agentId, oidcConfig);
    this.pendingRefreshes.set(agentId, refreshPromise);

    try {
      return await refreshPromise;
    } finally {
      this.pendingRefreshes.delete(agentId);
    }
  }

  /**
   * Fetch a new token from OIDC provider and store it in backend
   */
  private async refreshToken(agentId: string, config: OidcConfig): Promise<string> {
    let tokenEndpoint = config.tokenEndpoint;

    if (!tokenEndpoint) {
      tokenEndpoint = await OidcTokenService.discoverTokenEndpoint(config.issuerUrl);
    }

    if (!config.clientSecret) {
      throw new Error('Client secret is required for client credentials grant');
    }

    const result = await OidcTokenService.fetchToken(
      tokenEndpoint,
      config.clientId,
      config.clientSecret,
      config.scopes,
    );

    // Store in memory cache
    this.cache.set(agentId, result);

    // Store in backend for secure persistence
    try {
      const expiresIn = Math.floor((result.expiresAt - Date.now()) / 1000);
      await storeToken(agentId, result.accessToken, undefined, expiresIn);
      console.log('[TokenManager] Stored token in backend for agent:', agentId);
    } catch (error) {
      console.error('[TokenManager] Failed to store token in backend:', error);
      // Continue anyway - token is still in memory
    }

    return result.accessToken;
  }

  /**
   * Clear token from both memory and backend
   */
  async clearToken(agentId: string): Promise<void> {
    this.cache.delete(agentId);
    try {
      await clearBackendToken(agentId);
      console.log('[TokenManager] Cleared token from backend for agent:', agentId);
    } catch (error) {
      console.error('[TokenManager] Failed to clear token from backend:', error);
    }
  }

  /**
   * Clear all tokens from memory (backend tokens remain for session)
   */
  clearAll(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const tokenManager = new TokenManager();
