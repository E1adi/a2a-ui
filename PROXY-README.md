# A2A Proxy Server

A separate proxy service that allows the A2A UI to communicate with any agent, bypassing CORS restrictions.

## How It Works

```
Frontend (localhost:5174)
    ↓ fetch with X-Target-URL header
Proxy Server (localhost:3001)
    ↓ forwards request to target
Agent (any URL: localhost:5050, https://example.com, etc.)
    ↓ response
Proxy Server
    ↓ streams back
Frontend
```

## Starting the Proxy

### Option 1: Start Everything Together (Recommended)

```bash
npm start
```

This runs both the proxy server and the Vite dev server concurrently.

### Option 2: Start Separately

Terminal 1 - Proxy:
```bash
npm run proxy
```

Terminal 2 - Frontend:
```bash
npm run dev
```

## Configuration

The proxy runs on **port 3001** by default.

To change the proxy URL, set the environment variable:

```bash
# .env
VITE_PROXY_URL=http://localhost:3001/proxy
```

## How Requests Are Proxied

All A2A requests now go through the proxy:

1. **Agent Discovery:**
   ```javascript
   GET http://localhost:3001/proxy
   Headers:
     X-Target-URL: http://localhost:5050/.well-known/agent-card.json
   ```

2. **Send Message:**
   ```javascript
   POST http://localhost:3001/proxy
   Headers:
     X-Target-URL: http://localhost:5050
     Content-Type: application/json
     Authorization: Bearer <token>
   Body: { jsonrpc: "2.0", method: "message/send", ... }
   ```

3. **Streaming:**
   ```javascript
   POST http://localhost:3001/proxy
   Headers:
     X-Target-URL: http://localhost:5050
     Accept: text/event-stream
   ```

## Benefits

✅ **Dynamic**: Works with any agent URL without config changes
✅ **CORS-free**: No CORS issues with any agent
✅ **Auth preserved**: Bearer tokens passed through
✅ **Streaming support**: Handles SSE responses
✅ **Multi-agent**: Can proxy to multiple different agents simultaneously

## Production Deployment

For production, deploy the proxy server alongside your app:

1. **Same server:**
   ```bash
   node proxy-server.mjs &
   npm run build && npm run preview
   ```

2. **Separate service:**
   - Deploy `proxy-server.mjs` as a standalone service
   - Set `VITE_PROXY_URL` to point to the deployed proxy
   - Build and deploy the frontend

3. **Docker:**
   ```dockerfile
   FROM node:20
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3001 4173
   CMD ["sh", "-c", "node proxy-server.mjs & npm run preview"]
   ```

## Troubleshooting

**Proxy not starting:**
- Check if port 3001 is already in use
- Change PORT in proxy-server.mjs

**Requests failing:**
- Check proxy logs in the terminal
- Verify the agent URL is accessible from the proxy server
- Check for firewall/network issues

**CORS errors still happening:**
- Make sure you're using the proxy URL
- Check browser Network tab to verify requests go to localhost:3001
- Restart the proxy server
