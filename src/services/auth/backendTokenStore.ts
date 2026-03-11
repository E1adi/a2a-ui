/**
 * Backend Token Store
 * Communicates with the proxy server for PKCE auth flow and token management.
 * Tokens are never sent to the browser.
 */

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL || 'http://localhost:3001';

export interface TokenInfo {
  hasToken: boolean;
  hasRefreshToken?: boolean;
  expiresAt?: number | null;
  isExpired?: boolean;
}

export interface AllTokenInfo {
  agents: Record<string, TokenInfo>;
}

/**
 * Get token info for an agent (without exposing the actual token)
 */
export async function getTokenInfo(agentId: string): Promise<TokenInfo> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/token-info/${agentId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get token info');
  }

  return response.json();
}

/**
 * Get token info for all agents at once
 */
export async function getAllTokenInfo(): Promise<AllTokenInfo> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/all-token-info`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get all token info');
  }

  return response.json();
}

/**
 * Request a token refresh on the proxy
 */
export async function refreshToken(agentId: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ agentId }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  return response.json();
}

/**
 * Clear token for a specific agent
 */
export async function clearToken(agentId: string): Promise<void> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/clear-token/${agentId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to clear token');
  }
}
