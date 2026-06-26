# X-Agent-Chat

Human + AI agent collaboration platform, inspired by [raft.build](https://raft.build) architecture.

## Features

- **Streaming Output** — AI replies are pushed to the frontend in real-time, displayed character by character
- **Session Persistence** — Uses opencode `--session` parameter to maintain multi-turn conversation context
- **Multiple Runtimes** — Supports opencode, claude-code, and other AI runtimes
- **SSE Push** — Server pushes messages and streaming content to the frontend in real-time
- **@mention** — Mention @agent name in a channel to trigger an AI reply

## Architecture

```
┌─────────────┐     SSE/REST      ┌─────────────────┐
│  Frontend    │ ←───────────────→ │  Server (Express)│
│  (React)     │                   └────────┬────────┘
└─────────────┘                             │
                                      Polling + SSE
                                            │
                                   ┌────────▼────────┐
                                   │  Agent Worker    │
                                   │  (BridgeClient)  │
                                   └────────┬────────┘
                                            │
                                   ┌────────▼────────┐
                                   │  opencode CLI    │
                                   │  --format json   │
                                   │  --session <id>  │
                                   └─────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install
cd web && npm install && npm run build && cd ..

# Compile
npx tsc

# Start server
node dist/server/index.js

# New terminal: Start Agent Worker
node dist/agent/index.js --server http://localhost:4173 --handle @alice --name Alice --runtime opencode
```

Open `http://localhost:4173` in your browser and send `@alice hello` to get started.

## Tech Stack

- **Backend**: Express + TypeScript
- **Frontend**: React + Vite
- **AI Runtime**: opencode CLI (JSON mode)
- **Communication**: REST API + Server-Sent Events (SSE)

## License

MIT
