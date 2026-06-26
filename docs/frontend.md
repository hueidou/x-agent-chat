# 前端文档

## 技术栈

- React 18
- Vite
- TypeScript
- CSS (无框架)

## 目录结构

```
web/
├── src/
│   ├── main.tsx          # 入口
│   ├── App.tsx           # 主组件
│   ├── App.css           # 样式
│   ├── api.ts            # API 客户端
│   ├── types.ts          # 类型定义
│   └── components/
│       ├── Sidebar.tsx   # 侧边栏
│       ├── ChatArea.tsx  # 聊天区域
│       ├── MessageInput.tsx  # 消息输入
│       ├── AgentPanel.tsx    # Agent 面板
│       └── TaskPanel.tsx     # 任务面板
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 组件架构

### App.tsx

**状态**:
```typescript
const [server, setServer] = useState<ServerInfo | null>(null)
const [agents, setAgents] = useState<Agent[]>([])
const [channels, setChannels] = useState<Channel[]>([])
const [messages, setMessages] = useState<Message[]>([])
const [tasks, setTasks] = useState<Task[]>([])
const [activeChannel, setActiveChannel] = useState('all')
const [streaming, setStreaming] = useState<StreamingState | null>(null)
```

**数据流**:
1. 初始加载: `load()` 获取 server, agents, channels, tasks
2. 消息加载: `loadMessages(channelName)` 获取频道消息
3. SSE 监听: 监听 `/api/stream` 接收实时事件

### ChatArea.tsx

**Props**:
```typescript
interface Props {
  channel: Channel | undefined
  messages: Message[]
  streaming?: StreamingState | null
}
```

**流式显示**:
```tsx
{streaming && (
  <div className="msg streaming-msg">
    <div className="msg-avatar msg-agent">
      {streaming.agentName[0].toUpperCase()}
    </div>
    <div className="msg-body">
      <div className="msg-header">
        <span className="msg-name">{streaming.agentName}</span>
        <span className="streaming-indicator">正在回复...</span>
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

**功能**:
- 输入框 + 发送按钮
- @mention 自动补全
- Enter 发送

## SSE 事件处理

```typescript
useEffect(() => {
  const src = new EventSource('/api/stream')
  src.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.type === 'agent_stream') {
      if (data.status === 'done') {
        setStreaming(null)           // 清除流式状态
        loadMessages(activeChannel)  // 重新加载消息
      } else {
        setStreaming({               // 更新流式内容
          agentName: data.agentName,
          content: data.content,
          status: data.status
        })
      }
    } else if (data.type === 'message') {
      loadMessages(activeChannel)    // 新消息
    }
  }
  return () => src.close()
}, [activeChannel])
```

## API 客户端

**文件**: `web/src/api.ts`

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

## 样式主题

**CSS 变量**:
```css
:root {
  --bg: #0d1117;           /* 背景 */
  --surface: #161b22;      /* 表面 */
  --border: #30363d;       /* 边框 */
  --text: #e6edf3;         /* 文字 */
  --text-dim: #8b949e;     /* 暗文字 */
  --accent: #58a6ff;       /* 强调色 */
  --green: #3fb950;        /* 绿色 (人类) */
  --purple: #a371f7;       /* 紫色 (Agent) */
  --orange: #d29922;       /* 橙色 */
  --red: #f85149;          /* 红色 */
}
```

**流式动画**:
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

## Vite 配置

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4173',  // 开发时代理到后端
    },
  },
})
```

## 构建

```bash
cd web
npm install
npm run build  # 输出到 web/dist/
```

Server 会自动服务 `web/dist/` 下的静态文件。
