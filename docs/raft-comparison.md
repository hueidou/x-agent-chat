# Comparison with raft.build

## Overview

X-Agent-Chat is inspired by [raft.build](https://raft.build)'s architecture, but with a simplified implementation.

## Architecture Comparison

| Dimension | raft.build | X-Agent-Chat |
|-----------|-----------|--------------|
| Server | Cloud (raft.build) | Local (Express) |
| Auth | OAuth + API Key | None |
| Communication | WebSocket | REST + SSE |
| Storage | Cloud database | Local file |
| Agent | Daemon + multi-agent | Single Worker single Agent |

## Agent Integration Comparison

| Dimension | raft.build | X-Agent-Chat |
|-----------|-----------|--------------|
| Launch method | `opencode --mcp` | `opencode run --format json` |
| Output format | MCP (JSON-RPC) | JSON event stream |
| Session persistence | Long-running process | `--session <id>` |
| Streaming output | stdout data event | Line-by-line JSON parsing |
| Lifecycle | per_turn | per_turn |

## raft.build's OpenCode Driver

raft.build uses `OpenCodeDriver` to integrate with opencode:

```typescript
// raft.build's implementation
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

## X-Agent-Chat Simplifications

### 1. Removed Authentication

raft.build uses OAuth + API Key authentication. X-Agent-Chat simplifies to no authentication.

### 2. Removed Cloud Server

raft.build's server is in the cloud. X-Agent-Chat's server is local.

### 3. Simplified Communication Protocol

raft.build uses WebSocket + MCP. X-Agent-Chat uses REST + SSE.

### 4. Retained Core Design

- `--format json` structured output
- `--session <id>` session persistence
- Line-by-line JSON parsing
- Streaming callback mechanism

## raft.build Key Designs

### 1. per_turn Lifecycle

```typescript
lifecycle = {
  kind: 'per_turn',           // Start new process each turn
  start: 'defer_until_concrete_message',  // Delay until actual message
  exit: 'terminate_on_turn_end',          // Terminate after turn ends
  inFlightWake: 'coalesce_into_pending'   // Merge concurrent wakes
}
```

### 2. JSON Event Stream

```typescript
// raft.build defined event types
type RuntimeEvent = 
  | { kind: 'thinking', text: string }
  | { kind: 'text', text: string }
  | { kind: 'tool_call', name: string, input: any }
  | { kind: 'tool_output', name: string }
  | { kind: 'turn_end', sessionId?: string }
  | { kind: 'error', message: string }
  | { kind: 'session_init', sessionId: string }
```

### 3. Session Recovery

```typescript
// raft.build's session management
session = {
  recovery: 'resume_or_fresh'  // Try to recover, create new if failed
}

// Uses --session parameter
if (ctx.config.sessionId) {
  args.push('--session', ctx.config.sessionId)
}
```

### 4. Stdin Notification

```typescript
// raft.build supports stdin notification (opencode does not)
supportsStdinNotification = false

// Claude supports
encodeStdinMessage(text, sessionId) {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
    session_id: sessionId
  })
}
```

## Potential Improvements

### 1. Persistent Process Mode

raft.build uses persistent processes for Claude, which can reduce cold start. X-Agent-Chat could consider a similar mode for opencode.

### 2. Tool Call Support

raft.build parses tool_use events. X-Agent-Chat could display tool call processes.

### 3. Multi-Agent Collaboration

raft.build supports multiple agents collaborating in the same channel. X-Agent-Chat already supports this, but could be enhanced.

### 4. Error Recovery

raft.build has a more complete error recovery mechanism. X-Agent-Chat could learn from it.

## References

- raft.build: https://raft.build
- @botiverse/raft-daemon: npm package
- opencode: https://opencode.ai
