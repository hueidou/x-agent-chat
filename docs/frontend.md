# Frontend Documentation

## Tech Stack

- React 18
- Vite
- TypeScript
- CSS (no framework)

## Directory Structure

```
web/
├── src/
│   ├── main.tsx          # Entry point
│   ├── App.tsx           # Main component
│   ├── App.css           # Styles
│   ├── api.ts            # API client
│   ├── types.ts          # Type definitions
│   └── components/
│       ├── Sidebar.tsx   # Sidebar
│       ├── ChatArea.tsx  # Chat area
│       ├── MessageInput.tsx  # Message input
│       ├── AgentPanel.tsx    # Agent panel
│       └── TaskPanel.tsx     # Task panel
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Component Architecture

### App.tsx

**State**:
```typescript
const [server, setServer] = useState<ServerInfo | null>(null)
const [agents, setAgents] = useState<Agent[]>([])
const [channels, setChannels] = useState<Channel[]>([])
const [messages, setMessages] = useState<Message[]>([])
const [tasks, setTasks] = useState<Task[]>([])
const [activeChannel, setActiveChannel] = useState('all')
const [streaming, setStreaming] = useState<StreamingState | null>(null)
```

**Data Flow**:
1. Initial load: `load()` fetches server, agents, channels, tasks
2. Message load: `loadMessages(channelName)` fetches channel messages
3. SSE listener: Listens to `/api/stream` for real-time events

### ChatArea.tsx

**Props**:
```typescript
interface Props {
  channel: Channel | undefined
  messages: Message[]
  streaming?: StreamingState | null
}
```

**Streaming Display**:
```tsx
{streaming && (
  <div className="msg streaming-msg">
    <div className="msg-avatar msg-agent">
      {streaming.agentName[0].toUpperCase()}
    </div>
    <div className="msg-body">
      <div className="msg-header">
        <span className="msg-name">{streaming.agentName}</span>
        <span className="streaming-indicator">Replying...</span>
      </div>
      <div className="msg-text">
        {streaming.content}
        <span className="cursor-blink">|</span>
      </div>
    </div>
  </div>
)}
```

### MessageInput.tsx

**Features**:
- Input box + send button
- @mention autocomplete
- Enter to send

## SSE Event Handling

```typescript
useEffect(() => {
  const src = new EventSource('/api/stream')
  src.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.type === 'agent_stream') {
      if (data.status === 'done') {
        setStreaming(null)           // Clear streaming state
        loadMessages(activeChannel)  // Reload messages
      } else {
        setStreaming({               // Update streaming content
          agentName: data.agentName,
          content: data.content,
          status: data.status
        })
      }
    } else if (data.type === 'message') {
      loadMessages(activeChannel)    // New message
    }
  }
  return () => src.close()
}, [activeChannel])
```

## API Client

**File**: `web/src/api.ts`

```typescript
export const api = {
  server:        () => get<ServerInfo>('/server'),
  agents:        () => get<Agent[]>('/agents'),
  createAgent:   (n, d, r) => post<Agent>('/agents', { name: n, description: d, runtime: r }),
  updateAgent:   (h, b) => patch<Agent>(`/agents/${h}`, b),
  channels:      () => get<Channel[]>('/channels'),
  createChannel: (n) => post<Channel>('/channels', { name: n }),
  messages:      (ch) => get<Message[]>(`/channels/${ch}/messages`),
  sendMessage:   (ch, content, sender) => post<Message>(`/channels/${ch}/messages`, { content, senderHandle: sender }),
  tasks:         (status) => get<Task[]>(`/tasks${status ? `?status=${status}` : ''}`),
  createTask:    (t, d, a) => post<Task>('/tasks', { title: t, description: d, assignHandles: a }),
  updateTask:    (id, b) => patch<Task>(`/tasks/${id}`, b),
}
```

## Style Theme

**CSS Variables**:
```css
:root {
  --bg: #0d1117;           /* Background */
  --surface: #161b22;      /* Surface */
  --border: #30363d;       /* Border */
  --text: #e6edf3;         /* Text */
  --text-dim: #8b949e;     /* Dim text */
  --accent: #58a6ff;       /* Accent */
  --green: #3fb950;        /* Green (human) */
  --purple: #a371f7;       /* Purple (Agent) */
  --orange: #d29922;       /* Orange */
  --red: #f85149;          /* Red */
}
```

**Streaming Animation**:
```css
.streaming-indicator {
  animation: pulse 1.5s ease-in-out infinite;
}
.cursor-blink {
  animation: blink 0.8s step-end infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

## Vite Configuration

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4173',  // Proxy to backend during development
    },
  },
})
```

## Build

```bash
cd web
npm install
npm run build  # Output to web/dist/
```

Server automatically serves static files from `web/dist/`.
