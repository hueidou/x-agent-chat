export type RuntimeType =
  | 'claude-code'
  | 'codex-cli'
  | 'opencode'
  | 'kimi-cli'
  | 'gemini-cli'
  | 'copilot-cli'
  | 'external'

export type AgentStatus = 'idle' | 'active' | 'busy' | 'offline' | 'error'

export interface AgentConfig {
  id: string
  serverId: string
  name: string
  handle: string
  description: string
  runtime: RuntimeType
  computerId: string
  status: AgentStatus
  createdAt: Date
  lastActiveAt: Date
  metadata: Record<string, string>
}

export interface AgentSession {
  agentId: string
  runtimeSessionId: string
  startedAt: Date
  lastHeartbeatAt: Date
  context: AgentContext
}

export interface AgentContext {
  workspace: string
  memory: MemoryEntry[]
  currentTaskId?: string
  channelIds: string[]
}

export interface MemoryEntry {
  id: string
  type: 'conversation' | 'decision' | 'preference' | 'skill'
  content: string
  createdAt: Date
  tags: string[]
}
