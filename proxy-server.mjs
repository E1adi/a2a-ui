import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import crypto from 'crypto';
import {
  storeTokens,
  getTokens,
  getTokensByUrl,
  deleteTokens,
  getAllTokens,
  storePendingAuth,
  getPendingAuth,
  deletePendingAuth,
} from './db.mjs';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for the frontend
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// ─── PKCE Helpers ──────────────────────────────────────────────

function generateCodeVerifier() {
  // 32 random bytes → 43-char base64url string
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

// ─── OIDC Discovery Cache ──────────────────────────────────────

const discoveryCache = new Map(); // issuerUrl → { data, fetchedAt }
const DISCOVERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function discoverOidc(issuerUrl) {
  const cached = discoveryCache.get(issuerUrl);
  if (cached && Date.now() - cached.fetchedAt < DISCOVERY_CACHE_TTL) {
    return cached.data;
  }

  // Try the given issuerUrl first
  const base = issuerUrl.replace(/\/+$/, '');
  const url = base + '/.well-known/openid-configuration';
  let res = await fetch(url);

  // If it fails and the issuerUrl has a path, fall back to the origin
  // (handles cases where user pastes e.g. the JWKS URI instead of the issuer)
  if (!res.ok) {
    const parsed = new URL(issuerUrl);
    if (parsed.pathname !== '/') {
      const originUrl = parsed.origin + '/.well-known/openid-configuration';
      console.log(`[discoverOidc] ${url} returned ${res.status}, retrying at origin: ${originUrl}`);
      res = await fetch(originUrl);
    }
  }

  if (!res.ok) {
    throw new Error(`OIDC discovery failed for ${issuerUrl}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  discoveryCache.set(issuerUrl, { data, fetchedAt: Date.now() });
  return data;
}

// ─── Auth Endpoints ────────────────────────────────────────────

/**
 * POST /auth/start-auth
 * Initiates the PKCE authorization code flow.
 * Returns the authorization URL for the popup.
 */
app.post('/auth/start-auth', async (req, res) => {
  const { agentId, agentUrl, issuerUrl, clientId, clientSecret, scopes, audience } = req.body;

  if (!agentId || !agentUrl || !issuerUrl || !clientId) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'agentId, agentUrl, issuerUrl, and clientId are required',
    });
  }

  try {
    const oidcConfig = await discoverOidc(issuerUrl);
    const { authorization_endpoint, token_endpoint } = oidcConfig;

    if (!authorization_endpoint || !token_endpoint) {
      return res.status(400).json({
        error: 'Invalid OIDC configuration',
        message: 'authorization_endpoint and token_endpoint are required in OIDC discovery',
      });
    }

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = crypto.randomUUID();

    const redirectUri = process.env.OAUTH_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;

    // Store pending auth in SQLite
    storePendingAuth(state, {
      agentId,
      agentUrl,
      codeVerifier,
      tokenEndpoint: token_endpoint,
      clientId,
      clientSecret: clientSecret || null,
      scopes: scopes || '',
      redirectUri,
    });

    // Ensure 'openid' is always included in scope (required by most OIDC providers)
    const scopeSet = new Set((scopes || '').split(/\s+/).filter(Boolean));
    scopeSet.add('openid');
    const effectiveScopes = [...scopeSet].join(' ');

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: effectiveScopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    // SAP IAS: 'resource' sets the token audience to the target application's client ID
    if (audience) {
      params.set('resource', audience);
    }

    const authorizationUrl = `${authorization_endpoint}?${params.toString()}`;

    console.log(`[${new Date().toISOString()}] Started PKCE auth for agent: ${agentId}, state: ${state}`);

    res.json({ authorizationUrl, state });
  } catch (error) {
    console.error('[start-auth] Error:', error);
    res.status(500).json({ error: 'Failed to start auth', message: error.message });
  }
});

/**
 * GET /auth/callback
 * Serves the popup callback HTML page.
 * The page extracts code/state/error from URL params and sends them to the parent via postMessage.
 */
app.get('/auth/callback', (req, res) => {
  // Log callback params for debugging
  if (req.query.code) {
    console.log(`[${new Date().toISOString()}] Auth callback received: state=${req.query.state}`);
  }

  res.send(`<!DOCTYPE html>
<html>
<head><title>Authorization Callback</title></head>
<body>
<p id="status">Processing authorization...</p>
<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var code = params.get('code');
  var state = params.get('state');
  var error = params.get('error');
  var errorDescription = params.get('error_description');

  if (window.opener) {
    window.opener.postMessage({
      type: 'oauth-callback',
      code: code,
      state: state,
      error: error,
      errorDescription: errorDescription
    }, '*');
    setTimeout(function() { window.close(); }, 1000);
  } else if (code && state) {
    // Opened directly (not as popup) — exchange code here
    document.getElementById('status').textContent = 'Exchanging code for token...';
    fetch('/auth/exchange-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, state: state })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        document.getElementById('status').textContent = 'Authentication successful! You can close this tab.';
      } else {
        document.getElementById('status').textContent = 'Token exchange failed: ' + (data.message || 'Unknown error');
      }
    })
    .catch(function(err) {
      document.getElementById('status').textContent = 'Error: ' + err.message;
    });
  } else if (error) {
    document.getElementById('status').textContent = 'Authorization failed: ' + (errorDescription || error);
  }
})();
</script>
</body>
</html>`);
});

/**
 * POST /auth/exchange-code
 * Exchanges the authorization code for tokens using the stored code_verifier.
 * Tokens are stored in SQLite; never returned to the browser.
 */
app.post('/auth/exchange-code', async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'code and state are required',
    });
  }

  try {
    const pending = getPendingAuth(state);
    if (!pending) {
      return res.status(400).json({
        error: 'Invalid state',
        message: 'No pending authorization found for this state. It may have expired.',
      });
    }

    const { agent_id, agent_url, code_verifier, token_endpoint, client_id, client_secret, scopes, redirect_uri } = pending;

    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect_uri,
      code_verifier: code_verifier,
    });

    // Build headers — use Basic auth if client_secret is present, otherwise public client
    const tokenHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (client_secret) {
      tokenHeaders['Authorization'] = 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64');
    } else {
      tokenBody.set('client_id', client_id);
    }

    const tokenRes = await fetch(token_endpoint, {
      method: 'POST',
      headers: tokenHeaders,
      body: tokenBody,
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error('[exchange-code] Token exchange failed:', tokenRes.status, errorBody);
      // Clean up pending auth
      deletePendingAuth(state);
      return res.status(400).json({
        error: 'Token exchange failed',
        message: `IDP returned ${tokenRes.status}: ${errorBody}`,
      });
    }

    const tokenData = await tokenRes.json();
    const expiresAt = tokenData.expires_in
      ? Math.floor(Date.now() / 1000) + tokenData.expires_in
      : null;

    // Store tokens in SQLite (keyed by agent_url)
    storeTokens(agent_url, {
      agentId: agent_id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt,
      tokenEndpoint: token_endpoint,
      clientId: client_id,
      clientSecret: client_secret || null,
      scopes: scopes || null,
    });

    // Clean up pending auth
    deletePendingAuth(state);

    console.log(`[${new Date().toISOString()}] Token exchange successful for agent: ${agent_id}`);

    res.json({ success: true, agentId: agent_id });
  } catch (error) {
    console.error('[exchange-code] Error:', error);
    res.status(500).json({ error: 'Token exchange error', message: error.message });
  }
});

/**
 * POST /auth/refresh
 * Refreshes tokens using the stored refresh_token.
 */
app.post('/auth/refresh', async (req, res) => {
  const { agentId } = req.body;

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  try {
    const tokenRow = getTokens(agentId);
    if (!tokenRow) {
      return res.json({ success: false, error: 'No tokens found for this agent' });
    }
    if (!tokenRow.refresh_token) {
      return res.json({ success: false, error: 'No refresh token available' });
    }

    const refreshBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
    });
    if (tokenRow.scopes) {
      refreshBody.set('scope', tokenRow.scopes);
    }

    const refreshHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (tokenRow.client_secret) {
      refreshHeaders['Authorization'] = 'Basic ' + Buffer.from(`${tokenRow.client_id}:${tokenRow.client_secret}`).toString('base64');
    } else {
      refreshBody.set('client_id', tokenRow.client_id);
    }

    const refreshRes = await fetch(tokenRow.token_endpoint, {
      method: 'POST',
      headers: refreshHeaders,
      body: refreshBody,
    });

    if (!refreshRes.ok) {
      const errorBody = await refreshRes.text();
      console.error(`[refresh] Failed for agent ${agentId}:`, refreshRes.status, errorBody);
      return res.json({ success: false, error: `Refresh failed: ${refreshRes.status}` });
    }

    const newTokenData = await refreshRes.json();
    const expiresAt = newTokenData.expires_in
      ? Math.floor(Date.now() / 1000) + newTokenData.expires_in
      : null;

    // Update tokens (use rotated refresh_token if provided, otherwise keep existing)
    storeTokens(tokenRow.agent_url, {
      agentId,
      accessToken: newTokenData.access_token,
      refreshToken: newTokenData.refresh_token || tokenRow.refresh_token,
      expiresAt,
      tokenEndpoint: tokenRow.token_endpoint,
      clientId: tokenRow.client_id,
      clientSecret: tokenRow.client_secret,
      scopes: tokenRow.scopes,
    });

    console.log(`[${new Date().toISOString()}] Token refreshed for agent: ${agentId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[refresh] Error:', error);
    res.json({ success: false, error: error.message });
  }
});

/**
 * GET /auth/all-token-info
 * Returns token status for all agents (for app startup check).
 */
app.get('/auth/all-token-info', (req, res) => {
  const allTokens = getAllTokens();
  const agents = {};
  const now = Math.floor(Date.now() / 1000);

  for (const row of allTokens) {
    agents[row.agent_id] = {
      hasToken: true,
      hasRefreshToken: !!row.refresh_token,
      isExpired: row.access_token_expires_at ? row.access_token_expires_at < now : false,
      expiresAt: row.access_token_expires_at,
    };
  }

  res.json({ agents });
});

/**
 * GET /auth/token-info/:agentId
 * Returns token status for a specific agent (without exposing the actual token).
 */
app.get('/auth/token-info/:agentId', (req, res) => {
  const { agentId } = req.params;
  const tokenRow = getTokens(agentId);

  if (!tokenRow) {
    return res.json({ hasToken: false });
  }

  const now = Math.floor(Date.now() / 1000);
  res.json({
    hasToken: true,
    hasRefreshToken: !!tokenRow.refresh_token,
    expiresAt: tokenRow.access_token_expires_at,
    isExpired: tokenRow.access_token_expires_at ? tokenRow.access_token_expires_at < now : false,
  });
});

/**
 * DELETE /auth/clear-token/:agentId
 * Clear tokens for an agent.
 */
app.delete('/auth/clear-token/:agentId', (req, res) => {
  const { agentId } = req.params;
  deleteTokens(agentId);
  console.log(`[${new Date().toISOString()}] Cleared token for agent: ${agentId}`);
  res.json({ success: true });
});

// ─── Auto-refresh helper ───────────────────────────────────────

const TOKEN_EXPIRY_BUFFER_S = 60; // Refresh 60s before expiry

async function ensureFreshToken(agentId) {
  const tokenRow = getTokens(agentId);
  if (!tokenRow) return null;

  const now = Math.floor(Date.now() / 1000);
  const isExpired = tokenRow.access_token_expires_at &&
    tokenRow.access_token_expires_at < now + TOKEN_EXPIRY_BUFFER_S;

  if (!isExpired) {
    return tokenRow.access_token;
  }

  // Try to refresh
  if (!tokenRow.refresh_token) {
    console.log(`[proxy] Token expired for agent ${agentId}, no refresh token available`);
    return tokenRow.access_token; // Return expired token, let upstream handle it
  }

  console.log(`[proxy] Auto-refreshing expired token for agent ${agentId}`);

  try {
    const refreshBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
    });
    if (tokenRow.scopes) {
      refreshBody.set('scope', tokenRow.scopes);
    }

    const refreshHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (tokenRow.client_secret) {
      refreshHeaders['Authorization'] = 'Basic ' + Buffer.from(`${tokenRow.client_id}:${tokenRow.client_secret}`).toString('base64');
    } else {
      refreshBody.set('client_id', tokenRow.client_id);
    }

    const refreshRes = await fetch(tokenRow.token_endpoint, {
      method: 'POST',
      headers: refreshHeaders,
      body: refreshBody,
    });

    if (!refreshRes.ok) {
      console.error(`[proxy] Auto-refresh failed for agent ${agentId}: ${refreshRes.status}`);
      return tokenRow.access_token; // Return expired token
    }

    const newTokenData = await refreshRes.json();
    const expiresAt = newTokenData.expires_in
      ? Math.floor(Date.now() / 1000) + newTokenData.expires_in
      : null;

    storeTokens(tokenRow.agent_url, {
      agentId,
      accessToken: newTokenData.access_token,
      refreshToken: newTokenData.refresh_token || tokenRow.refresh_token,
      expiresAt,
      tokenEndpoint: tokenRow.token_endpoint,
      clientId: tokenRow.client_id,
      clientSecret: tokenRow.client_secret,
      scopes: tokenRow.scopes,
    });

    console.log(`[proxy] Auto-refresh successful for agent ${agentId}`);
    return newTokenData.access_token;
  } catch (error) {
    console.error(`[proxy] Auto-refresh error for agent ${agentId}:`, error.message);
    return tokenRow.access_token;
  }
}

// ─── Dynamic Proxy ─────────────────────────────────────────────

app.all('/proxy', async (req, res) => {
  const targetUrl = req.headers['x-target-url'];

  if (!targetUrl) {
    return res.status(400).json({
      error: 'Missing X-Target-URL header',
      message: 'Please provide the target URL in the X-Target-URL header',
    });
  }

  // Look up token by URL prefix match
  const tokenRow = getTokensByUrl(targetUrl);
  const agentId = tokenRow?.agent_id;

  console.log(`[${new Date().toISOString()}] ${req.method} ${targetUrl}${agentId ? ` (agent: ${agentId})` : ''}`);

  let triedRefresh = false;

  const doRequest = async (accessToken) => {
    // Prepare headers (exclude host and other problematic headers)
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['x-target-url'];
    delete headers.connection;
    delete headers['content-length'];

    // Inject token if available
    if (accessToken) {
      headers['authorization'] = `Bearer ${accessToken}`;
      console.log(`[${new Date().toISOString()}] Injected token for agent: ${agentId}`);
    }

    // Prepare fetch options
    const options = {
      method: req.method,
      headers,
    };

    // Add body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    return fetch(targetUrl, options);
  };

  try {
    // Get fresh token for this agent
    let accessToken = agentId ? await ensureFreshToken(agentId) : null;

    let response = await doRequest(accessToken);

    // Handle 401/403: try refresh once then retry
    if (agentId && (response.status === 401 || response.status === 403) && !triedRefresh) {
      triedRefresh = true;
      const tokenRow = getTokens(agentId);

      if (tokenRow?.refresh_token) {
        console.log(`[proxy] Got ${response.status} for agent ${agentId}, attempting token refresh...`);

        try {
          const refreshBody = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenRow.refresh_token,
          });
          if (tokenRow.scopes) {
            refreshBody.set('scope', tokenRow.scopes);
          }

          const retryRefreshHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
          if (tokenRow.client_secret) {
            retryRefreshHeaders['Authorization'] = 'Basic ' + Buffer.from(`${tokenRow.client_id}:${tokenRow.client_secret}`).toString('base64');
          } else {
            refreshBody.set('client_id', tokenRow.client_id);
          }

          const refreshRes = await fetch(tokenRow.token_endpoint, {
            method: 'POST',
            headers: retryRefreshHeaders,
            body: refreshBody,
          });

          if (refreshRes.ok) {
            const newTokenData = await refreshRes.json();
            const expiresAt = newTokenData.expires_in
              ? Math.floor(Date.now() / 1000) + newTokenData.expires_in
              : null;

            storeTokens(tokenRow.agent_url, {
              agentId,
              accessToken: newTokenData.access_token,
              refreshToken: newTokenData.refresh_token || tokenRow.refresh_token,
              expiresAt,
              tokenEndpoint: tokenRow.token_endpoint,
              clientId: tokenRow.client_id,
              clientSecret: tokenRow.client_secret,
              scopes: tokenRow.scopes,
            });

            accessToken = newTokenData.access_token;
            console.log(`[proxy] Refresh successful, retrying request for agent ${agentId}`);
            response = await doRequest(accessToken);
          } else {
            console.error(`[proxy] Refresh failed for agent ${agentId}: ${refreshRes.status}`);
            // Set header to notify frontend
            res.setHeader('X-Auth-Status', 'refresh-failed');
          }
        } catch (refreshError) {
          console.error(`[proxy] Refresh error for agent ${agentId}:`, refreshError.message);
          res.setHeader('X-Auth-Status', 'refresh-failed');
        }
      } else {
        // No refresh token, notify frontend
        res.setHeader('X-Auth-Status', 'refresh-failed');
      }
    }

    // Handle SSE/streaming responses
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // Stream SSE responses — set headers individually to preserve CORS headers from middleware
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.status(response.status);

      response.body.pipe(res);

      response.body.on('end', () => {
        res.end();
      });

      response.body.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      // Handle regular responses
      const data = await response.text();

      // Copy response headers (skip CORS and problematic headers — cors middleware handles CORS)
      const skipHeaders = new Set([
        'transfer-encoding', 'connection', 'keep-alive',
        'access-control-allow-origin', 'access-control-allow-credentials',
        'access-control-allow-methods', 'access-control-allow-headers',
        'access-control-expose-headers', 'access-control-max-age',
      ]);
      response.headers.forEach((value, key) => {
        if (!skipHeaders.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      // Send response
      res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message,
      target: targetUrl,
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   A2A Proxy Server                     ║
║   Running on http://localhost:${PORT}    ║
║   SQLite: ./data/tokens.db             ║
╚════════════════════════════════════════╝

Ready to proxy requests to any agent!
`);
});
