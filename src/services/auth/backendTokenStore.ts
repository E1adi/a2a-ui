/**
 * Backend Token Store
 * Communicates with the proxy server to securely store and retrieve tokens
 */

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL || 'http://localhost:3001';

export interface TokenInfo {
  hasToken: boolean;
  hasRefreshToken?: boolean;
  expiresAt?: number | null;
  isExpired?: boolean;
}

/**
 * Store tokens for an agent on the backend
 */
export async function storeToken(
  agentId: string,
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number,
): Promise<void> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/store-token`, {
    method: 'POST',
    credentials: 'include', // Include session cookie
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to store token');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error('Failed to store token');
  }
}

/**
 * Get token info for an agent (without exposing the actual token)
 */
export async function getTokenInfo(agentId: string): Promise<TokenInfo> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/token-info/${agentId}`, {
    credentials: 'include', // Include session cookie
  });

  if (!response.ok) {
    throw new Error('Failed to get token info');
  }

  return response.json();
}

/**
 * Clear token for a specific agent
 */
export async function clearToken(agentId: string): Promise<void> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/clear-token/${agentId}`, {
    method: 'DELETE',
    credentials: 'include', // Include session cookie
  });

  if (!response.ok) {
    throw new Error('Failed to clear token');
  }
}

/**
 * Clear all tokens for the current session
 */
export async function clearAllTokens(): Promise<void> {
  const response = await fetch(`${PROXY_BASE_URL}/auth/clear-all-tokens`, {
    method: 'POST',
    credentials: 'include', // Include session cookie
  });

  if (!response.ok) {
    throw new Error('Failed to clear all tokens');
  }
}
