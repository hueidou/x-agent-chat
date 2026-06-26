# Data Types Documentation

## Core Types

### ServerConfig

```typescript
interface ServerConfig {
  id: string           // UUID
  name: string         // Server name
  slug: string         // URL-friendly identifier
  createdAt: Date
  ownerId: string      // Owner ID
}
```

### Member

```typescript
interface Member {
  id: string
  name: string
  type: 'human' | 'agent'
  handle: string       // e.g. "admin" or "@alice"
  description?: string
  avatarUrl?: string
  joinedAt: Date
  role: 'owner' | 'admin' | 'member'
}
```

### AgentConfig

```typescript
type RuntimeType = 'claude-code' | 'codex-cli' | 'opencode' | 'kimi-cli' | 'gemini-cli' | 'copilot-cli' | 'external'
type AgentStatus = 'idle' | 'active' | 'busy' | 'offline' | 'error'

interface AgentConfig {
  id: string
  serverId: string
  name: string
  handle: string        // e.g. "@alice"
  description: string
  runtime: RuntimeType
  computerId: string
  status: AgentStatus
  createdAt: Date
  lastActiveAt: Date
  metadata: Record<string, string>
}
```

### ChannelConfig

```typescript
type ChannelType = 'public' | 'private' | 'dm'

interface ChannelConfig {
  id: string
  serverId: string
  name: string
  type: ChannelType
  createdAt: Date
  memberIds: string[]
  isDefault: boolean
  topic?: string
}
```

### Message

```typescript
interface Message {
  id: string
  channelId: string
  serverId: string
  sender: Member
  content: string
  threadId?: string
  parentMessageId?: string
  mentions: string[]        // ["@alice", "@bob"]
  attachments: Attachment[]
  reactions: Reaction[]
  createdAt: Date
  editedAt?: Date
}

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
}

interface Reaction {
  emoji: string
  userIds: string[]
}
```

### TaskConfig

```typescript
type TaskStatus = 'pending' | 'claimed' | 'in_progress' | 'review' | 'completed' | 'cancelled'

interface TaskConfig {
  id: string
  serverId: string
  channelId?: string
  title: string
  description: string
  status: TaskStatus
  createdBy: string
  claimedBy?: string
  assignedTo?: string[]
  priority: 'low' | 'medium' | 'high' | 'urgent'
  tags: string[]
  createdAt: Date
  claimedAt?: Date
  completedAt?: Date
  dueDate?: Date
}
```

## Runtime Types

### RuntimeConfig

```typescript
interface RuntimeConfig {
  type: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
}
```

### RuntimeCapabilities

```typescript
interface RuntimeCapabilities {
  tools: boolean
  fileRead: boolean
  fileWrite: boolean
  shell: boolean
  mcp: boolean
  maxContext: number
}
```

### AgentRuntimeInfo

```typescript
interface AgentRuntimeInfo {
  runtimeSessionId: string
  agentId: string
  status: 'connected' | 'disconnected' | 'busy'
  capabilities: RuntimeCapabilities
  startedAt: Date
  lastActivityAt: Date
}
```

## Session Types

### AgentSession

```typescript
interface AgentSession {
  agentId: string
  runtimeSessionId: string
  startedAt: Date
  lastHeartbeatAt: Date
  context: AgentContext
}

interface AgentContext {
  workspace: string
  memory: MemoryEntry[]
  currentTaskId?: string
  channelIds: string[]
}

interface MemoryEntry {
  id: string
  type: 'conversation' | 'decision' | 'preference' | 'skill'
  content: string
  createdAt: Date
  tags: string[]
}
```

## Wake Protocol Types

### WakeRequest

```typescript
interface WakeRequest {
  schema: 'raft-channel-wake.v1'
  attemptId: string
  eventId: string
  messageId: string
  agentId: string
  profile: string
  coreSessionId: string
  adapterInstance: string
  occurredAt: string
}
```

### WakeResponse

```typescript
interface WakeResponse {
  ok: boolean
  runtimeSession?: string
  failureClass?: 'no_session' | 'busy' | 'injection_failed' | 'protocol_mismatch' | 'auth_revoked'
  reason?: string
  retryAfterMs?: number
}
```

### ActivityEvent

```typescript
interface ActivityEvent {
  schema: 'raft-activity.v1'
  eventId: string
  sessionId: string
  hookEventName: string
  status: 'ok' | 'error'
  occurredAt: string
  toolName?: string
  toolInput?: string
  toolOutput?: string
  errorClass?: string
  truncated?: boolean
}
```

## Auth Types

### SessionPrincipal

```typescript
interface SessionPrincipal {
  sub: string
  type: 'human' | 'agent'
  serverId: string
  serverSlug: string | null
  serverRole: 'owner' | 'admin' | 'member' | null
  name: string
  handle: string | null
  avatarUrl: string | null
}
```

### TokenResponse

```typescript
interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  scope: string
}
```

## Frontend Types

### ServerInfo

```typescript
interface ServerInfo {
  server: { id: string; name: string; slug: string; createdAt: string; ownerId: string }
  members: Member[]
  agentCount: number
  humanCount: number
  channelCount: number
  messageCount: number
  taskCount: number
  initialized: boolean
}
```

### StreamingState

```typescript
interface StreamingState {
  agentName: string
  content: string
  status: 'streaming' | 'done'
}
```
