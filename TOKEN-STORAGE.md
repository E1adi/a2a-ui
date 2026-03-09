# Token Storage - Backend-for-Frontend Pattern

## Overview

The A2A UI implements secure token storage using the **Backend-for-Frontend (BFF)** pattern. OAuth tokens are stored server-side in the proxy server, never exposed to client-side JavaScript, and automatically injected into agent requests.

## Architecture

```
┌─────────────┐                  ┌──────────────┐                 ┌─────────────┐
│   Browser   │                  │ Proxy Server │                 │ A2A Agent   │
│   (React)   │ ◄───────────────►│  (Express)   │ ◄──────────────►│             │
└─────────────┘                  └──────────────┘                 └─────────────┘
      │                                  │
      │  1. Fetch token from OIDC       │
      │  2. Store via /auth/store-token │
      │     (with session cookie)       │
      │                                  │
      │  3. Send message via /proxy     │
      │     (includes X-Agent-ID)       │
      │                                  │
      │                          4. Inject Bearer token
      │                             from session store
      │                                  │
      │                          5. Forward to agent
      │                             with Authorization header
```

## How It Works

### 1. Token Acquisition (Client-Side)

When an agent requires authentication:

1. Client fetches token from OIDC provider (client credentials grant)
2. Token is sent to backend via `POST /auth/store-token`
3. Backend stores token in session-scoped memory (Map<sessionId, Map<agentId, tokenData>>)
4. Client receives confirmation

```typescript
// Client code
const token = await fetchTokenFromOIDC(oidcConfig);
await storeToken(agentId, token.access_token, token.refresh_token, token.expires_in);
```

### 2. Automatic Token Injection (Server-Side)

When making requests through the proxy:

1. Client includes `X-Agent-ID` header in proxy request
2. Proxy looks up token for this agent in session store
3. Proxy injects `Authorization: Bearer <token>` header
4. Request forwarded to agent with token

```javascript
// Proxy server
const tokenData = agentTokens.get(req.session.id)?.get(agentId);
if (tokenData) {
  headers['authorization'] = `Bearer ${tokenData.access_token}`;
}
```

### 3. Session Management

- Sessions use `express-session` with httpOnly cookies
- Tokens stored in-memory per session (lost on server restart)
- 24-hour session lifetime
- No tokens persisted to disk

## Security Features

✅ **httpOnly cookies** - Session cookies not accessible to JavaScript
✅ **SameSite=strict** - CSRF protection
✅ **In-memory storage** - No disk persistence of secrets
✅ **Automatic token injection** - Tokens never sent to client
✅ **Session-scoped** - Isolated per user session
✅ **No client-side exposure** - Tokens never in localStorage/sessionStorage

## API Endpoints

### Store Token
```bash
POST /auth/store-token
Content-Type: application/json
Cookie: connect.sid=<session-id>

{
  "agentId": "agent-123",
  "access_token": "eyJhbGc...",
  "refresh_token": "optional",
  "expires_in": 3600
}
```

### Get Token Info
```bash
GET /auth/token-info/:agentId
Cookie: connect.sid=<session-id>

Response:
{
  "hasToken": true,
  "hasRefreshToken": true,
  "expiresAt": 1234567890000,
  "isExpired": false
}
```

### Clear Token
```bash
DELETE /auth/clear-token/:agentId
Cookie: connect.sid=<session-id>
```

### Clear All Tokens
```bash
POST /auth/clear-all-tokens
Cookie: connect.sid=<session-id>
```

## Usage

### Start the Application
```bash
# Start both proxy and UI
npm start

# Or separately:
npm run proxy  # Terminal 1
npm run dev    # Terminal 2
```

### Configure Agent Authentication

When adding an agent with OIDC:

1. Open "Add Agent" dialog
2. Enter agent URL and discover
3. Expand "OIDC Authentication" section
4. Fill in:
   - Issuer URL (e.g., `https://auth.example.com`)
   - Client ID
   - Client Secret
   - Scopes (optional)
5. Save agent

The UI will automatically:
- Fetch tokens on first message send
- Store tokens in backend
- Include agent ID in all subsequent requests
- Backend will inject tokens automatically

## Development Notes

### Session Secret

The proxy uses a default session secret for development. **Change this in production:**

```bash
SESSION_SECRET=your-secure-random-secret node proxy-server.mjs
```

### Token Expiry

Tokens are checked for expiry (60s buffer). Currently, expired tokens are still used (the agent will reject them). Future enhancement: implement automatic token refresh using refresh tokens.

### Scaling

This implementation uses in-memory storage, suitable for:
- Personal use
- Small teams (each person runs their own instance)
- Single-server deployments with sticky sessions

For multi-server production deployments, replace `Map` with Redis:
```javascript
import RedisStore from 'connect-redis';
app.use(session({ store: new RedisStore({ client: redisClient }) }));
```

## Troubleshooting

### "Failed to store token"

**Cause:** Session not initialized
**Fix:** Ensure cookies are enabled and CORS credentials set correctly

### Token not being injected

**Cause:** Missing X-Agent-ID header
**Fix:** Verify agent ID is passed to streaming/client functions

### Tokens lost after refresh

**Expected behavior:** Tokens are session-scoped and survive page refresh. If lost after server restart, this is normal (in-memory storage).

## Future Enhancements

- [ ] Automatic token refresh using refresh tokens
- [ ] Redis/database storage for multi-server deployments
- [ ] Token revocation on agent deletion
- [ ] Token usage analytics
- [ ] Support for other grant types (authorization code, device flow)
