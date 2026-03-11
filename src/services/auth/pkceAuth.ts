/**
 * PKCE Authorization Code Flow via popup window.
 * Tokens never reach the browser — the proxy handles token exchange and storage.
 */

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL || 'http://localhost:3001';

const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function authenticateWithPopup(
  agentId: string,
  agentUrl: string,
  issuerUrl: string,
  clientId: string,
  scopes: string,
  clientSecret?: string,
  audience?: string,
): Promise<void> {
  // Open popup synchronously to avoid popup blockers.
  // We open about:blank first, then navigate after getting the authorization URL.
  const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
  const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;
  const popup = window.open(
    'about:blank',
    'oauth-popup',
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`,
  );

  if (!popup) {
    throw new Error('Popup blocked. Please allow popups for this site and try again.');
  }

  try {
    // Get authorization URL from proxy
    const startRes = await fetch(`${PROXY_BASE_URL}/auth/start-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ agentId, agentUrl, issuerUrl, clientId, scopes, clientSecret, audience }),
    });

    if (!startRes.ok) {
      const error = await startRes.json();
      throw new Error(error.message || 'Failed to start authentication');
    }

    const { authorizationUrl, state } = await startRes.json();

    // Navigate the popup to the IDP
    popup.location.href = authorizationUrl;

    // Wait for the callback message from the popup
    const { code } = await waitForCallback(popup, state);

    // Exchange the code for tokens on the proxy
    const exchangeRes = await fetch(`${PROXY_BASE_URL}/auth/exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, state }),
    });

    if (!exchangeRes.ok) {
      const error = await exchangeRes.json();
      throw new Error(error.message || 'Token exchange failed');
    }

    const result = await exchangeRes.json();
    if (!result.success) {
      throw new Error('Token exchange was not successful');
    }
  } finally {
    if (popup && !popup.closed) {
      popup.close();
    }
  }
}

function waitForCallback(
  popup: Window,
  expectedState: string,
): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let pollId: ReturnType<typeof setInterval>;

    const cleanup = () => {
      clearTimeout(timeoutId);
      clearInterval(pollId);
      window.removeEventListener('message', messageHandler);
    };

    const messageHandler = (event: MessageEvent) => {
      // Accept messages from any origin since the IDP redirects to our proxy
      if (event.data?.type !== 'oauth-callback') return;

      const { code, state, error, errorDescription } = event.data;

      if (error) {
        cleanup();
        reject(new Error(errorDescription || error || 'Authorization failed'));
        return;
      }

      if (state !== expectedState) {
        // Ignore messages with wrong state (could be from another flow)
        return;
      }

      if (!code) {
        cleanup();
        reject(new Error('No authorization code received'));
        return;
      }

      cleanup();
      resolve({ code, state });
    };

    window.addEventListener('message', messageHandler);

    // Timeout
    timeoutId = setTimeout(() => {
      cleanup();
      if (popup && !popup.closed) popup.close();
      reject(new Error('Authentication timed out. Please try again.'));
    }, AUTH_TIMEOUT_MS);

    // Poll for manual popup close
    pollId = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Authentication cancelled — popup was closed.'));
      }
    }, 500);
  });
}
