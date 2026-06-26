# Agent Worker Documentation

## Overview

Agent Worker is the bridge between the server and AI runtime. It polls the server for messages, detects @mentions, calls the AI, and pushes streaming replies.

## Core Components

### BridgeClient

**File**: `agent/BridgeClient.ts`

**Responsibilities**:
1. Poll the server for new messages
2. Detect @mentions
3. Call RuntimeAdapter
4. Push streaming replies to the server

**Key Code**:
```typescript
class BridgeClient {
  private lastSeenTs = 0  // Uses timestamp instead of message ID

  private async checkMessages(adapter: RuntimeAdapter) {
    // 1. Get all channels
    // 2. Get messages for each channel
    // 3. Filter new messages (createdAt > lastSeenTs)
    // 4. Check @mention
    // 5. Call handleMessage
  }

  private async handleMessage(channelName, msg, adapter) {
    // 1. Build prompt
    // 2. Call adapter.execute(prompt, callbacks)
    // 3. Streaming callback push
    // 4. Send message after completion
  }
}
```

### RuntimeAdapter

**File**: `agent/RuntimeAdapter.ts`

**Interface**:
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

**File**: `agent/adapters/OpenCode.ts`

**Features**:
- Uses `--format json` for structured event streams
- Uses `--session <id>` for session recovery
- Parses JSON events line by line
- Supports streaming callbacks

**JSON Event Format**:
```json
{"type": "step_start", "sessionID": "ses_xxx"}  → onThinking
{"type": "text", "part": {"text": "..."}}        → onToken
{"type": "tool_use", "part": {"tool": "bash"}}   → onToolCall
{"type": "step_finish", "part": {"reason": "end"}} → onDone
{"type": "error", "error": {"message": "..."}}   → onError
```

**Launch Parameters**:
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

**File**: `agent/adapters/Claude.ts`

**Features**:
- Uses `claude -p` pipe mode
- Synchronous call, no streaming support
- No session persistence

## Startup

```bash
node dist/agent/index.js \
  --server http://localhost:4173 \
  --handle @alice \
  --name Alice \
  --runtime opencode
```

**Parameters**:
- `--server`: Server address
- `--handle`: Agent handle (e.g. @alice)
- `--name`: Agent display name
- `--runtime`: Runtime type (opencode/claude-code)

## Message Processing Flow

```
1. pollLoop executes every 3 seconds
   ↓
2. checkMessages fetches all channel messages
   ↓
3. Filter conditions:
   - createdAt > lastSeenTs
   - sender.handle !== this.handle (ignore self)
   - mentions.includes(this.handle) (check @mention)
   ↓
4. handleMessage builds prompt
   ↓
5. adapter.execute(prompt, callbacks)
   ↓
6. Streaming callbacks:
   - onToken → pushStreamUpdate(streaming)
   - onDone → pushStreamUpdate(done)
   ↓
7. POST message to server
```

## Streaming Push Mechanism

```typescript
// Streaming callbacks
callbacks: StreamCallbacks = {
  onToken: (text) => {
    streamingContent += text
    // Push every 500ms
    if (now - lastPushTs > 500) {
      this.pushStreamUpdate(channelName, streamingContent, 'streaming')
    }
  },
  onDone: (fullText) => {
    this.pushStreamUpdate(channelName, fullText, 'done')
  }
}

// Push to server
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

## Session Persistence

OpenCodeAdapter maintains `sessionId`:

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
    // Get sessionId from JSON events
    if (event.sessionID) {
      this.sessionId = event.sessionID
      callbacks?.onSession?.(event.sessionID)
    }
  }
}
```

## Error Handling

- Timeout: Kill process after 300 seconds
- Non-zero exit code: Throw error
- JSON parse failure: Skip that line
- Network error: Retry on next poll
