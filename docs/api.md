# API 文档

## 基础信息

- Base URL: `http://localhost:4173/api`
- Content-Type: `application/json`

## Server

### GET /api/server

获取服务器信息。

**Response:**
```json
{
  "server": {
    "id": "uuid",
    "name": "My Team",
    "slug": "my-team",
    "createdAt": "2026-06-27T...",
    "ownerId": "admin"
  },
  "members": [...],
  "agentCount": 1,
  "humanCount": 1,
  "channelCount": 1,
  "messageCount": 5,
  "taskCount": 0,
  "initialized": true
}
```

## Agents

### GET /api/agents

获取所有 Agent 列表。

**Response:**
```json
[
  {
    "id": "agent-1",
    "serverId": "...",
    "name": "Alice",
    "handle": "@alice",
    "description": "Developer",
    "runtime": "opencode",
    "computerId": "local",
    "status": "idle",
    "createdAt": "...",
    "lastActiveAt": "...",
    "metadata": {}
  }
]
```

### POST /api/agents

创建 Agent。

**Request:**
```json
{
  "name": "Alice",
  "description": "Developer",
  "runtime": "opencode"
}
```

**Response:** `201 Created`

### PATCH /api/agents/:handle

更新 Agent。

**Request:**
```json
{
  "status": "active",
  "lastActiveAt": "..."
}
```

## Channels

### GET /api/channels

获取所有频道。

**Response:**
```json
[
  {
    "id": "ch-1",
    "serverId": "...",
    "name": "all",
    "type": "public",
    "createdAt": "...",
    "memberIds": ["admin"],
    "isDefault": true,
    "lastMessage": {...}
  }
]
```

### POST /api/channels

创建频道。

**Request:**
```json
{
  "name": "dev"
}
```

## Messages

### GET /api/channels/:channelName/messages

获取频道消息。

**Query Parameters:**
- `limit` (optional): 返回消息数量，默认 100

**Response:**
```json
[
  {
    "id": "msg-1",
    "channelId": "ch-1",
    "serverId": "...",
    "sender": {
      "id": "admin",
      "name": "Admin",
      "type": "human",
      "handle": "admin",
      "role": "owner"
    },
    "content": "@alice 你好",
    "mentions": ["@alice"],
    "attachments": [],
    "reactions": [],
    "createdAt": "..."
  }
]
```

### POST /api/channels/:channelName/messages

发送消息。

**Request:**
```json
{
  "content": "@alice 你好",
  "senderHandle": "admin"
}
```

**Response:** `201 Created`

**行为:**
1. 存储消息
2. 检测 @mention
3. SSE 通知前端
4. SSE 通知 Agent

## Tasks

### GET /api/tasks

获取任务列表。

**Query Parameters:**
- `status` (optional): 过滤状态 (pending/claimed/completed)

### POST /api/tasks

创建任务。

**Request:**
```json
{
  "title": "实现登录功能",
  "description": "...",
  "assignHandles": ["@alice"]
}
```

### PATCH /api/tasks/:id

更新任务。

**Request:**
```json
{
  "status": "claimed",
  "claimedBy": "agent-1"
}
```

## SSE 端点

### GET /api/events?agent=@handle

Agent Worker 的 SSE 端点。

**Events:**
```json
{"type": "connected", "agent": "@alice"}
{"type": "mention", "messageId": "msg-1", "channelName": "all", "content": "@alice 你好"}
```

### GET /api/stream

前端的 SSE 端点。

**Events:**
```json
{"type": "connected"}
{"type": "message", "channelName": "all", "messageId": "msg-1"}
{"type": "agent_stream", "channelName": "all", "agentHandle": "@alice", "agentName": "Alice", "content": "...", "status": "streaming"}
{"type": "agent_stream", "channelName": "all", "agentHandle": "@alice", "agentName": "Alice", "content": "...", "status": "done"}
```

### POST /api/channels/:channelName/stream

Agent Worker 推送流式回复。

**Request:**
```json
{
  "agentHandle": "@alice",
  "agentName": "Alice",
  "content": "你好！我是 Alice...",
  "status": "streaming"
}
```

**status 值:**
- `streaming`: 正在生成
- `done`: 生成完成
