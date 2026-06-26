# 与 raft.build 的对比

## 概述

X-Agent-Chat 参照 [raft.build](https://raft.build) 的架构设计，但简化了实现。

## 架构对比

| 维度 | raft.build | X-Agent-Chat |
|------|-----------|--------------|
| 服务器 | 云端 (raft.build) | 本地 (Express) |
| 认证 | OAuth + API Key | 无 |
| 通信 | WebSocket | REST + SSE |
| 存储 | 云端数据库 | 本地文件 |
| Agent | 守护进程 + 多 Agent | 单 Worker 单 Agent |

## Agent 对接对比

| 维度 | raft.build | X-Agent-Chat |
|------|-----------|--------------|
| 启动方式 | `opencode --mcp` | `opencode run --format json` |
| 输出格式 | MCP (JSON-RPC) | JSON 事件流 |
| 会话保持 | 进程常驻 | `--session <id>` |
| 流式输出 | stdout data 事件 | 逐行 JSON 解析 |
| 生命周期 | per_turn | per_turn |

## raft.build 的 OpenCode Driver

raft.build 使用 `OpenCodeDriver` 对接 opencode:

```typescript
// raft.build 的实现
class OpenCodeDriver {
  lifecycle = {
    kind: 'per_turn',
    start: 'defer_until_concrete_message',
    exit: 'terminate_on_turn_end',
    inFlightWake: 'coalesce_into_pending'
  }

  async spawn(ctx) {
    const args = [
      'run',
      '--format', 'json',
      '--dangerously-skip-permissions',
      '--pure',
      '--dir', ctx.workingDirectory
    ]
    if (ctx.config.sessionId) {
      args.push('--session', ctx.config.sessionId)
    }
    args.push('--', turnPrompt)

    const proc = spawn(spawnSpec.command, args, {
      cwd: ctx.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: launch.env,
    })
  }

  parseLine(line) {
    const event = JSON.parse(line)
    switch (event.type) {
      case 'step_start':
        return [{ kind: 'thinking', text: '' }]
      case 'text':
        return [{ kind: 'text', text: event.part.text }]
      case 'tool_use':
        return [{ kind: 'tool_call', name: event.part.tool, input: event.part.state.input }]
      case 'step_finish':
        return [{ kind: 'turn_end', sessionId: this.sessionId }]
      case 'error':
        return [{ kind: 'error', message: event.error.message }]
    }
  }
}
```

## X-Agent-Chat 的简化

### 1. 去掉了认证

raft.build 使用 OAuth + API Key 认证。X-Agent-Chat 简化为无认证。

### 2. 去掉了云端服务器

raft.build 的服务器在云端。X-Agent-Chat 的服务器在本地。

### 3. 简化了通信协议

raft.build 使用 WebSocket + MCP。X-Agent-Chat 使用 REST + SSE。

### 4. 保留了核心设计

- `--format json` 结构化输出
- `--session <id>` 会话保持
- 逐行 JSON 解析
- 流式回调机制

## raft.build 的关键设计

### 1. per_turn 生命周期

```typescript
lifecycle = {
  kind: 'per_turn',           // 每轮启动新进程
  start: 'defer_until_concrete_message',  // 延迟到实际消息才启动
  exit: 'terminate_on_turn_end',          // 轮次结束后终止
  inFlightWake: 'coalesce_into_pending'   // 合并并发唤醒
}
```

### 2. JSON 事件流

```typescript
// raft.build 定义的事件类型
type RuntimeEvent = 
  | { kind: 'thinking', text: string }
  | { kind: 'text', text: string }
  | { kind: 'tool_call', name: string, input: any }
  | { kind: 'tool_output', name: string }
  | { kind: 'turn_end', sessionId?: string }
  | { kind: 'error', message: string }
  | { kind: 'session_init', sessionId: string }
```

### 3. Session 恢复

```typescript
// raft.build 的 session 管理
session = {
  recovery: 'resume_or_fresh'  // 尝试恢复，失败则新建
}

// 使用 --session 参数
if (ctx.config.sessionId) {
  args.push('--session', ctx.config.sessionId)
}
```

### 4. Stdin 通知

```typescript
// raft.build 支持 stdin 通知（opencode 不支持）
supportsStdinNotification = false

// Claude 支持
encodeStdinMessage(text, sessionId) {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
    session_id: sessionId
  })
}
```

## 可以借鉴的改进

### 1. 持久进程模式

raft.build 对 Claude 使用持久进程，可以减少冷启动。X-Agent-Chat 可以考虑对 opencode 也使用类似模式。

### 2. 工具调用支持

raft.build 解析 tool_use 事件。X-Agent-Chat 可以展示工具调用过程。

### 3. 多 Agent 协作

raft.build 支持多 Agent 在同一频道协作。X-Agent-Chat 已支持，但可以增强。

### 4. 错误恢复

raft.build 有更完善的错误恢复机制。X-Agent-Chat 可以借鉴。

## 参考资料

- raft.build: https://raft.build
- @botiverse/raft-daemon: npm 包
- opencode: https://opencode.ai
