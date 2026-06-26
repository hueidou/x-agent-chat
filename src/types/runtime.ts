export interface RuntimeConfig {
  type: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
}

export interface RuntimeCapabilities {
  tools: boolean
  fileRead: boolean
  fileWrite: boolean
  shell: boolean
  mcp: boolean
  maxContext: number
}

export interface AgentRuntimeInfo {
  runtimeSessionId: string
  agentId: string
  status: 'connected' | 'disconnected' | 'busy'
  capabilities: RuntimeCapabilities
  startedAt: Date
  lastActivityAt: Date
}
