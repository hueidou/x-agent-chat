# Architecture Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Sidebar   │  │ ChatArea │  │ AgentPanel│  │ TaskPanel│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API + SSE
┌───────────────────────────▼─────────────────────────────────┐
│                    Express Server (:4173)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ /api/     │  │ /api/    │  │ /api/    │  │ /api/    │   │
│  │ agents    │  │ channels │  │ messages │  │ tasks    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐                                │
│  │ /api/    │  │ /api/    │                                │
│  │ events   │  │ stream   │                                │
│  │ (SSE)    │  │ (SSE)    │                                │
│  └──────────┘  └──────────┘                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │   FileStore   │
                    │  ~/.raft/     │
                    │  servers/     │
                    │  default.json │
                    └───────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    Agent Worker (BridgeClient)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Poll msgs │  │ Stream   │  │ SSE Push │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    RuntimeAdapter                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ OpenCode     │  │ Claude       │  │ (Extensible) │      │
│  │ --format json│  │ claude -p    │  │              │      │
│  │ --session    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Server (Express)

**Responsibilities**: REST API + SSE push + static file serving

- Manages CRUD for Agent, Channel, Message, Task
- Provides SSE endpoints `/api/events` (Agent) and `/api/stream` (Frontend)
- Notifies Agent Worker when messages contain @mentions

### 2. Agent Worker (BridgeClient)

**Responsibilities**: Poll messages → Call AI → Push streaming replies

- Polls the server every 3 seconds for new messages
- Calls RuntimeAdapter when @mention is detected
- Pushes streaming replies to the frontend via SSE

### 3. RuntimeAdapter

**Responsibilities**: Encapsulates calls to different AI runtimes

- `OpenCodeAdapter`: Uses `opencode run --format json --session <id>`
- `ClaudeAdapter`: Uses `echo "prompt" | claude -p`
- Supports streaming callbacks: `onToken`, `onThinking`, `onSession`

### 4. FileStore

**Responsibilities**: Local file persistence

- Data stored in `~/.raft/servers/default.json`
- Contains Server, Members, Channels, Messages, Tasks, Agents

## Data Flow

### Message Sending Flow

```
User input → POST /api/channels/:name/messages
  → Store message in FileStore
  → Check @mention
  → SSE notify frontend (broadcastToFrontend)
  → SSE notify Agent (sseSend)
```

### AI Reply Flow

```
Agent Worker detects @mention
  → Build prompt
  → Call RuntimeAdapter.execute(prompt, callbacks)
  → Streaming callback onToken → SSE push to frontend
  → After completion POST message to server
  → SSE notify frontend (broadcastToFrontend)
```

### Streaming Output Flow

```
OpenCode CLI (--format json)
  → Output JSON event stream
  → Parse line by line
  → Trigger callbacks:
     - step_start → onThinking
     - text → onToken (incremental)
     - tool_use → onToolCall
     - step_finish → onDone
     - error → onError
```

## Key Design Decisions

### 1. Why use `--format json` instead of `--format default`?

- JSON format is structured and can be parsed line by line
- Supports streaming output, no need to wait for process to finish
- Includes sessionID for session recovery

### 2. Why use `--session <id>` instead of creating a new session each time?

- Maintains context for multi-turn conversations
- Reduces cold start time
- Follows raft.build's design

### 3. Why use SSE instead of WebSocket?

- SSE is simpler, one-way push is sufficient
- Browser natively supports EventSource
- Automatic reconnection

### 4. Why separate Server and Worker?

- Server can be deployed remotely
- Worker must be local (to access AI CLI)
- Decoupled design, easy to extend
