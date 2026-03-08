import type { OidcConfig } from '../../types/index.ts';
import { OidcTokenService } from './oidc.ts';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000; // Refresh 60s before expiry

export class TokenManager {
  private cache = new Map<string, CachedToken>();
  private pendingRefreshes = new Map<string, Promise<string>>();

  async getToken(agentId: string, oidcConfig: OidcConfig): Promise<string> {
    const cached = this.cache.get(agentId);
    if (cached && cached.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
      return cached.accessToken;
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

    this.cache.set(agentId, result);
    return result.accessToken;
  }

  clearToken(agentId: string): void {
    this.cache.delete(agentId);
  }

  clearAll(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const tokenManager = new TokenManager();
