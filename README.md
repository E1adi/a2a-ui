# A2A Agent Chat UI

<div align="center">

![A2A Protocol](https://img.shields.io/badge/A2A_Protocol-v0.3.0-blue)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)
![SAP UI5](https://img.shields.io/badge/SAP_UI5-2.20-0FAAFF?logo=sap)

A modern chat interface for interacting with AI Agents using the **Agent-to-Agent (A2A) Protocol**. Built with React and SAP UI5 components, featuring secure token management and real-time streaming support.

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Architecture](#architecture)

</div>

---

## ✨ Features

### 🤖 Multi-Agent Support
- Dynamically add and manage multiple A2A agents
- Auto-discovery via `.well-known/agent-card.json`
- Separate conversation history per agent
- Beautiful glassmorphic UI with SAP Fiori Horizon design

### 🔐 Secure Authentication
- **Backend-for-Frontend (BFF)** pattern for token storage
- OIDC client credentials flow
- Tokens stored server-side with httpOnly cookies
- Automatic token injection in requests
- No client-side secret exposure

### 💬 Advanced Chat Features
- Real-time streaming responses (SSE)
- Request/response mode support
- Status indicators with pulsing animations
- Artifact rendering (files, data, code)
- Markdown support in messages
- Auto-scroll and conversation persistence

### 🌐 CORS Proxy
- Dynamic proxy server for local development
- Per-agent proxy toggle
- Automatic token injection
- SSE streaming support

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/E1adi/a2a-ui.git
cd a2a-ui

# Install dependencies
npm install

# Start both proxy and UI
npm start
```

The application will open at **http://localhost:5173** with the proxy running on **http://localhost:3001**.

### Alternative: Run Separately

```bash
# Terminal 1: Start proxy server
npm run proxy

# Terminal 2: Start UI
npm run dev
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [TOKEN-STORAGE.md](TOKEN-STORAGE.md) | Complete guide to secure token storage architecture |
| [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) | What was built and how it works |
| [SECURITY-NOTES.md](SECURITY-NOTES.md) | Security considerations and data storage |
| [PROXY-README.md](PROXY-README.md) | Proxy server documentation |

---

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│   React UI      │ ◄─────► │  Express Proxy   │ ◄─────► │  A2A Agent  │
│   (Port 5173)   │         │   (Port 3001)    │         │             │
└─────────────────┘         └──────────────────┘         └─────────────┘
       │                            │
       │                            │
   localStorage              Session Store
   (Agents, Chats)      (OAuth Tokens - httpOnly)
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript | Modern reactive UI |
| **UI Library** | SAP UI5 Web Components | Authentic SAP BTP look & feel |
| **State** | Zustand | Lightweight state management |
| **Build** | Vite | Fast development & production builds |
| **Backend** | Express.js | Proxy server & token management |
| **Sessions** | express-session | Secure server-side token storage |

---

## 🎯 Usage

### Adding an Agent

1. Click the **"+"** button in the sidebar
2. Enter your agent's base URL (e.g., `http://localhost:8080`)
3. Click **"Discover"** to fetch the agent card
4. (Optional) Configure OIDC authentication:
   - Issuer URL
   - Client ID
   - Client Secret
   - Scopes
5. Toggle **"Use Proxy"** if needed for CORS
6. Click **"Save Agent"**

### Chatting with an Agent

1. Select an agent from the sidebar
2. Type your message in the input area
3. Press **Enter** or click **Send**
4. View real-time responses with status indicators
5. Artifacts appear as expandable cards below messages

### Managing Conversations

- **New Conversation**: Select a different agent
- **Delete Conversation**: Click trash icon on conversation item
- **Delete Agent**: Click trash icon on agent card

---

## ⚙️ Configuration

Configuration is done via environment variables. Copy `.env.example` to `.env` and customize:

```bash
# Proxy Server
PORT=3001
SESSION_SECRET=your-random-secret-here
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174

# UI (Vite)
VITE_PROXY_URL=http://localhost:3001/proxy
VITE_PROXY_BASE_URL=http://localhost:3001
```

---

## 🔒 Security

### Token Storage

OAuth tokens are **never** stored client-side. Instead:

1. Client fetches tokens from OIDC provider
2. Tokens sent to backend via `/auth/store-token`
3. Backend stores in session-scoped memory
4. httpOnly cookies prevent JavaScript access
5. Backend auto-injects tokens in agent requests

**Client secrets** are NOT persisted anywhere - they must be re-entered each session.

See [TOKEN-STORAGE.md](TOKEN-STORAGE.md) for complete security details.

---

## 📁 Project Structure

```
a2a-ui/
├── src/
│   ├── components/
│   │   ├── agents/          # Agent management UI
│   │   ├── chat/            # Chat interface components
│   │   └── layout/          # App shell & sidebar
│   ├── services/
│   │   ├── a2a/             # A2A protocol client & streaming
│   │   └── auth/            # OIDC & token management
│   ├── store/               # Zustand state stores
│   ├── hooks/               # React hooks
│   └── types/               # TypeScript types
├── proxy-server.mjs         # Express proxy with token storage
├── package.json
└── vite.config.ts
```

---

## 🛠️ Development

### Build for Production

```bash
npm run build
```

Output will be in `dist/`.

### Linting

```bash
npm run lint
```

### Preview Production Build

```bash
npm run preview
```

---

## 🚢 Deployment

### Single User / Small Team
The default in-memory token storage works perfectly:
```bash
npm install
npm start
```

### Multi-User Production
For production with multiple users, replace in-memory storage with Redis:

```javascript
// proxy-server.mjs
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ... rest of config
}));
```

See [TOKEN-STORAGE.md](TOKEN-STORAGE.md#scaling) for details.

---

## 🧪 Testing

### Token Storage Test

```bash
# Store a token
curl -c cookies.txt -X POST http://localhost:3001/auth/store-token \
  -H "Content-Type: application/json" \
  -d '{"agentId": "test", "access_token": "token123", "expires_in": 3600}'

# Verify token info
curl -b cookies.txt http://localhost:3001/auth/token-info/test

# Test automatic injection
curl -b cookies.txt http://localhost:3001/proxy \
  -H "X-Target-URL: https://httpbin.org/headers" \
  -H "X-Agent-ID: test"
```

### UI Integration Test

Open `file:///tmp/test-token-storage.html` in your browser (created during setup).

---

## 📝 License

This project is private and not licensed for public use.

---

## 🙏 Acknowledgments

- [A2A Protocol](https://github.com/anthropics/agent-protocol) - Agent-to-Agent communication standard
- [SAP UI5 Web Components](https://sap.github.io/ui5-webcomponents-react/) - Enterprise-grade UI library
- [Zustand](https://github.com/pmndrs/zustand) - State management

---

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

<div align="center">
Built with ❤️ using React, TypeScript, and SAP UI5
</div>
