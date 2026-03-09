import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import session from 'express-session';

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

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'a2a-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: true,  // Create session even if not modified
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',  // Changed from 'strict' to allow session cookies in curl tests
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
}));

// In-memory token store: sessionId -> Map<agentId, tokenData>
const agentTokens = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Store tokens for an agent
app.post('/auth/store-token', (req, res) => {
  const { agentId, access_token, refresh_token, expires_in } = req.body;

  if (!agentId || !access_token) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'agentId and access_token are required'
    });
  }

  if (!req.session) {
    return res.status(500).json({
      error: 'Session not initialized',
      message: 'Server session configuration error'
    });
  }

  const sessionId = req.session.id;

  // Initialize session's token map if needed
  if (!agentTokens.has(sessionId)) {
    agentTokens.set(sessionId, new Map());
  }

  // Store token data
  const tokenData = {
    access_token,
    refresh_token,
    expires_at: expires_in ? Date.now() + (expires_in * 1000) : null
  };

  agentTokens.get(sessionId).set(agentId, tokenData);

  console.log(`[${new Date().toISOString()}] Stored token for agent: ${agentId}, session: ${sessionId}`);

  res.json({ success: true });
});

// Get token info for an agent (without exposing the actual token)
app.get('/auth/token-info/:agentId', (req, res) => {
  const { agentId } = req.params;

  if (!req.session || !req.session.id) {
    return res.json({ hasToken: false });
  }

  const sessionTokens = agentTokens.get(req.session.id);
  const tokenData = sessionTokens?.get(agentId);

  if (!tokenData) {
    return res.json({ hasToken: false });
  }

  res.json({
    hasToken: true,
    hasRefreshToken: !!tokenData.refresh_token,
    expiresAt: tokenData.expires_at,
    isExpired: tokenData.expires_at ? tokenData.expires_at < Date.now() : false
  });
});

// Clear tokens for an agent
app.delete('/auth/clear-token/:agentId', (req, res) => {
  const { agentId } = req.params;

  if (!req.session || !req.session.id) {
    return res.json({ success: false, message: 'No session' });
  }

  const sessionTokens = agentTokens.get(req.session.id);
  if (sessionTokens) {
    sessionTokens.delete(agentId);
    console.log(`[${new Date().toISOString()}] Cleared token for agent: ${agentId}`);
  }

  res.json({ success: true });
});

// Clear all tokens for the current session
app.post('/auth/clear-all-tokens', (req, res) => {
  if (!req.session || !req.session.id) {
    return res.json({ success: false, message: 'No session' });
  }

  agentTokens.delete(req.session.id);
  console.log(`[${new Date().toISOString()}] Cleared all tokens for session: ${req.session.id}`);

  res.json({ success: true });
});

// Dynamic proxy endpoint with automatic token injection
app.all('/proxy', async (req, res) => {
  const targetUrl = req.headers['x-target-url'];
  const agentId = req.headers['x-agent-id'];

  if (!targetUrl) {
    return res.status(400).json({
      error: 'Missing X-Target-URL header',
      message: 'Please provide the target URL in the X-Target-URL header',
    });
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${targetUrl}${agentId ? ` (agent: ${agentId})` : ''}`);

  try {
    // Get token for this agent if available
    let tokenData = null;
    if (agentId && req.session && req.session.id) {
      const sessionTokens = agentTokens.get(req.session.id);
      tokenData = sessionTokens?.get(agentId);

      // Check if token is expired (with 60s buffer)
      if (tokenData && tokenData.expires_at && tokenData.expires_at < Date.now() + 60000) {
        console.log(`[${new Date().toISOString()}] Token expired for agent: ${agentId}, needs refresh`);
        // TODO: Implement token refresh logic here if refresh_token is available
        // For now, we'll use the expired token and let the client handle re-auth
      }
    }

    // Prepare headers (exclude host and other problematic headers)
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['x-target-url'];
    delete headers['x-agent-id'];
    delete headers.connection;
    delete headers['content-length'];

    // Inject token if available
    if (tokenData && tokenData.access_token) {
      headers['authorization'] = `Bearer ${tokenData.access_token}`;
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

    // Make the request to the target
    const response = await fetch(targetUrl, options);

    // Handle SSE/streaming responses
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // Stream SSE responses
      res.writeHead(response.status, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

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

      // Copy response headers
      response.headers.forEach((value, key) => {
        // Skip problematic headers
        if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
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
╚════════════════════════════════════════╝

Ready to proxy requests to any agent!
`);
});
