# Data Storage Locations

## Not Committed (Local Only)

### Browser localStorage
- **Agent configurations**: `localStorage['a2a-agent-storage']`
  - Contains: agent URLs, OIDC issuer URLs, client IDs
  - **Excluded**: clientSecret (stripped by Zustand partialize)
  
- **Conversations**: `localStorage['a2a-chat-storage']`
  - Contains: conversation history, messages, artifacts
  
### Server Session Storage
- **OAuth tokens**: In-memory Map (lost on server restart)
  - Keyed by session ID + agent ID
  - Never persisted to disk

## Security Notes

1. **Client secrets** are NOT persisted anywhere (must be re-entered each session)
2. **OAuth tokens** are stored server-side only (httpOnly cookies)
3. **No .env file** should be committed (use .env.example as template)
4. **Session secret** should be changed in production

## Clean Reset

To completely reset:
```bash
# Clear browser localStorage (in browser console)
localStorage.clear()

# Restart proxy (clears tokens)
npm run proxy
```

