# Agent Worker 文档

## 概述

Agent Worker 是连接服务器和 AI 运行时的桥梁。它轮询服务器消息，检测 @mention，调用 AI，推送流式回复。

## 核心组件

### BridgeClient

**文件**: `agent/BridgeClient.ts`

**职责**:
1. 轮询服务器检查新消息
2. 检测 @mention
3. 调用 RuntimeAdapter
4. 推送流式回复到服务器

**关键代码**:
```typescript
class BridgeClient {
  private lastSeenTs = 0  // 使用时间戳而不是消息ID

  private async checkMessages(adapter: RuntimeAdapter) {
    // 1. 获取所有频道
    // 2. 获取每个频道的消息
    // 3. 过滤新消息 (createdAt > lastSeenTs)
    // 4. 检查 @mention
    // 5. 调用 handleMessage
  }

  private async handleMessage(channelName, msg, adapter) {
    // 1. 构建 prompt
    // 2. 调用 adapter.execute(prompt, callbacks)
    // 3. 流式回调推送
    // 4. 完成后发送消息
  }
}
```

### RuntimeAdapter

**文件**: `agent/RuntimeAdapter.ts`

**接口**:
```typescript
interface StreamCallbacks {
  onToken?: (text: string) => void
  onThinking?: (text: string) => void
  onToolCall?: (name: string, input: any) => void
  onToolOutput?: (name: string) => void
  onSession?: (sessionId: string) => void
  onDone?: (fullText: string) => void
  onError?: (message: string) => void
}

interface RuntimeAdapter {
  readonly type: RuntimeType
  execute(prompt: string, callbacks?: StreamCallbacks): Promise<string>
  isAvailable(): boolean
}
```

### OpenCodeAdapter

**文件**: `agent/adapters/OpenCode.ts`

**特性**:
- 使用 `--format json` 获取结构化事件流
- 使用 `--session <id>` 恢复会话
- 逐行解析 JSON 事件
- 支持流式回调

**JSON 事件格式**:
```json
{"type": "step_start", "sessionID": "ses_xxx"}  → onThinking
{"type": "text", "part": {"text": "..."}}        → onToken
{"type": "tool_use", "part": {"tool": "bash"}}   → onToolCall
{"type": "step_finish", "part": {"reason": "end"}} → onDone
{"type": "error", "error": {"message": "..."}}   → onError
```

**启动参数**:
```bash
opencode run \
  --format json \
  --pure \
  --dir <workDir> \
  --dangerously-skip-permissions \
  --session <sessionId> \
  -- <prompt>
```

### ClaudeAdapter

**文件**: `agent/adapters/Claude.ts`

**特性**:
- 使用 `claude -p` 管道模式
- 同步调用，不支持流式
- 无会话保持

## 启动方式

```bash
node dist/agent/index.js \
  --server http://localhost:4173 \
  --handle @alice \
  --name Alice \
  --runtime opencode
```

**参数**:
- `--server`: 服务器地址
- `--handle`: Agent 的 handle (如 @alice)
- `--name`: Agent 的显示名称
- `--runtime`: 运行时类型 (opencode/claude-code)

## 消息处理流程

```
1. pollLoop 每 3 秒执行一次
   ↓
2. checkMessages 获取所有频道消息
   ↓
3. 过滤条件:
   - createdAt > lastSeenTs
   - sender.handle !== this.handle (忽略自己)
   - mentions.includes(this.handle) (检查 @mention)
   ↓
4. handleMessage 构建 prompt
   ↓
5. adapter.execute(prompt, callbacks)
   ↓
6. 流式回调:
   - onToken → pushStreamUpdate(streaming)
   - onDone → pushStreamUpdate(done)
   ↓
7. POST 消息到服务器
```

## 流式推送机制

```typescript
// 流式回调
callbacks: StreamCallbacks = {
  onToken: (text) => {
    streamingContent += text
    // 每 500ms 推送一次
    if (now - lastPushTs > 500) {
      this.pushStreamUpdate(channelName, streamingContent, 'streaming')
    }
  },
  onDone: (fullText) => {
    this.pushStreamUpdate(channelName, fullText, 'done')
  }
}

// 推送到服务器
private async pushStreamUpdate(channelName, content, status) {
  await fetch(`${serverUrl}/api/channels/${channelName}/stream`, {
    method: 'POST',
    body: JSON.stringify({
      agentHandle: this.handle,
      agentName: this.name,
      content,
      status  // 'streaming' | 'done'
    })
  })
}
```

## 会话保持

OpenCodeAdapter 维护 `sessionId`:

```typescript
class OpenCodeAdapter {
  private sessionId: string | null = null

  async execute(prompt, callbacks) {
    const args = ['run', '--format', 'json', ...]
    if (this.sessionId) {
      args.push('--session', this.sessionId)
    }
    args.push('--', prompt)
    // ...
    // 从 JSON 事件中获取 sessionId
    if (event.sessionID) {
      this.sessionId = event.sessionID
      callbacks?.onSession?.(event.sessionID)
    }
  }
}
```

## 错误处理

- 超时: 300 秒后 kill 进程
- 非零退出码: 抛出错误
- JSON 解析失败: 跳过该行
- 网络错误: 重试下一轮询
