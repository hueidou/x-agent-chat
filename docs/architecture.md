# 架构设计

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器 (React)                         │
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
│  │ 轮询消息  │  │ 流式回复  │  │ SSE 推送  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    RuntimeAdapter                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ OpenCode     │  │ Claude       │  │ (扩展)        │      │
│  │ --format json│  │ claude -p    │  │              │      │
│  │ --session    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Server (Express)

**职责**: REST API + SSE 推送 + 静态文件服务

- 管理 Agent、Channel、Message、Task 的 CRUD
- 提供 SSE 端点 `/api/events` (Agent) 和 `/api/stream` (前端)
- 当消息包含 @mention 时，通知 Agent Worker

### 2. Agent Worker (BridgeClient)

**职责**: 轮询消息 → 调用 AI → 推送流式回复

- 每 3 秒轮询服务器检查新消息
- 检测到 @mention 后调用 RuntimeAdapter
- 通过 SSE 推送流式回复到前端

### 3. RuntimeAdapter

**职责**: 封装不同 AI 运行时的调用

- `OpenCodeAdapter`: 使用 `opencode run --format json --session <id>`
- `ClaudeAdapter`: 使用 `echo "prompt" | claude -p`
- 支持流式回调: `onToken`, `onThinking`, `onSession`

### 4. FileStore

**职责**: 本地文件持久化

- 数据存储在 `~/.raft/servers/default.json`
- 包含 Server、Members、Channels、Messages、Tasks、Agents

## 数据流

### 消息发送流程

```
用户输入 → POST /api/channels/:name/messages
  → 存储消息到 FileStore
  → 检查 @mention
  → SSE 通知前端 (broadcastToFrontend)
  → SSE 通知 Agent (sseSend)
```

### AI 回复流程

```
Agent Worker 检测 @mention
  → 构建 prompt
  → 调用 RuntimeAdapter.execute(prompt, callbacks)
  → 流式回调 onToken → SSE 推送到前端
  → 完成后 POST 消息到服务器
  → SSE 通知前端 (broadcastToFrontend)
```

### 流式输出流程

```
OpenCode CLI (--format json)
  → 输出 JSON 事件流
  → 逐行解析
  → 触发回调:
     - step_start → onThinking
     - text → onToken (增量)
     - tool_use → onToolCall
     - step_finish → onDone
     - error → onError
```

## 关键设计决策

### 1. 为什么用 `--format json` 而不是 `--format default`?

- JSON 格式是结构化的，可以逐行解析
- 支持流式输出，不需要等进程结束
- 包含 sessionID，支持会话恢复

### 2. 为什么用 `--session <id>` 而不是每次新建会话?

- 保持上下文，支持多轮对话
- 减少冷启动时间
- 参照 raft.build 的设计

### 3. 为什么用 SSE 而不是 WebSocket?

- SSE 更简单，单向推送足够
- 浏览器原生支持 EventSource
- 自动重连

### 4. 为什么 Server 和 Worker 分离?

- Server 可以部署在远程
- Worker 必须在本地（访问 AI CLI）
- 解耦设计，易于扩展
