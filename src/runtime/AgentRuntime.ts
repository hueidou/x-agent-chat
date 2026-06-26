import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import {
  AgentConfig, AgentSession, MemoryEntry,
  RuntimeType, AgentRuntimeInfo, RuntimeCapabilities,
} from '../types/index.js'
import { WakeBridgeServer, buildWakeContent, buildWakeMeta } from './WakeBridge.js'

export interface RuntimeAdapter {
  type: RuntimeType
  start(agent: AgentConfig): Promise<AgentSession>
  stop(): Promise<void>
  sendWake(content: string, meta: Record<string, string>): Promise<void>
  getInfo(): AgentRuntimeInfo
  onStdout(data: string): void
  onStderr(data: string): void
  emit(event: string | symbol, ...args: any[]): boolean
  on(event: string | symbol, listener: (...args: any[]) => void): this
}

export class MCPRuntimeAdapter extends EventEmitter implements RuntimeAdapter {
  type: RuntimeType
  private process: ChildProcess | null = null
  private sessionId: string | null = null
  private agentId: string
  private command: string
  private args: string[]

  constructor(agentId: string, type: RuntimeType, command: string, args: string[] = []) {
    super()
    this.agentId = agentId
    this.type = type
    this.command = command
    this.args = args
  }

  async start(agent: AgentConfig): Promise<AgentSession> {
    this.sessionId = `session-${agent.id}-${Date.now()}`
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RAFT_AGENT_ID: agent.id,
        RAFT_AGENT_NAME: agent.name,
        RAFT_SERVER_ID: agent.serverId,
        RAFT_SESSION_ID: this.sessionId,
      },
    })

    this.process.on('error', (err) => {
      try { this.emit('runtime:error', err) } catch {}
      this.process = null
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      this.onStdout(data.toString())
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      this.onStderr(data.toString())
    })

    this.process.on('exit', (code) => {
      this.emit('exit', code)
      this.process = null
    })

    return {
      agentId: agent.id,
      runtimeSessionId: this.sessionId,
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
      context: {
        workspace: `/tmp/raft/${agent.id}`,
        memory: [],
        channelIds: [],
      },
    }
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed && this.process.pid) {
      try {
        this.process.kill('SIGTERM')
        await new Promise(resolve => setTimeout(resolve, 2000))
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      } catch {
        // process already dead
      }
      this.process = null
    }
  }

  async sendWake(content: string, meta: Record<string, string>): Promise<void> {
    if (!this.process?.stdin?.writable) return
    const wake = JSON.stringify({ type: 'wake', content, meta }) + '\n'
    this.process.stdin.write(wake)
  }

  getInfo(): AgentRuntimeInfo {
    return {
      runtimeSessionId: this.sessionId ?? '',
      agentId: this.agentId,
      status: this.process ? 'connected' : 'disconnected',
      capabilities: {
        tools: true,
        fileRead: true,
        fileWrite: true,
        shell: true,
        mcp: true,
        maxContext: 128000,
      },
      startedAt: new Date(),
      lastActivityAt: new Date(),
    }
  }

  onStdout(data: string): void {
    this.emit('stdout', data)
  }

  onStderr(data: string): void {
    this.emit('stderr', data)
  }
}

export class RuntimeManager {
  private adapters = new Map<string, RuntimeAdapter>()
  private sessions = new Map<string, AgentSession>()
  private wakeBridges = new Map<string, WakeBridgeServer>()

  registerAdapter(agentId: string, adapter: RuntimeAdapter): void {
    this.adapters.set(agentId, adapter)
  }

  async startAgent(agent: AgentConfig): Promise<AgentSession> {
    const adapter = this.adapters.get(agent.id)
    if (!adapter) throw new Error(`No adapter registered for agent ${agent.id}`)
    const session = await adapter.start(agent)
    this.sessions.set(agent.id, session)

    const bridge = new WakeBridgeServer(
      {
        onWake: async (req) => {
          await adapter.sendWake(buildWakeContent(req), buildWakeMeta(req))
          return { ok: true, runtimeSession: session.runtimeSessionId }
        },
        onActivity: async (event) => {
          adapter.emit('activity', event)
        },
      },
      { agentId: agent.id, profile: agent.name }
    )
    bridge.enableActivityTracking()
    this.wakeBridges.set(agent.id, bridge)

    return session
  }

  async stopAgent(agentId: string): Promise<void> {
    const adapter = this.adapters.get(agentId)
    if (adapter) {
      await adapter.stop()
      this.adapters.delete(agentId)
    }
    this.sessions.delete(agentId)
    this.wakeBridges.delete(agentId)
  }

  async wake(agentId: string, messageId: string): Promise<void> {
    const bridge = this.wakeBridges.get(agentId)
    if (bridge) {
      await bridge.handleWake('default', messageId)
    }
  }

  getInfo(agentId: string): AgentRuntimeInfo | null {
    return this.adapters.get(agentId)?.getInfo() ?? null
  }

  getSession(agentId: string): AgentSession | null {
    return this.sessions.get(agentId) ?? null
  }
}

export const RUNTIME_COMMANDS: Record<RuntimeType, { command: string; args: string[] }> = {
  'claude-code': { command: 'claude', args: ['--channel', 'mcp'] },
  'codex-cli': { command: 'codex', args: ['--mcp'] },
  'opencode': { command: 'opencode', args: ['--mcp'] },
  'kimi-cli': { command: 'kimi', args: ['--mcp'] },
  'gemini-cli': { command: 'gemini', args: ['--mcp'] },
  'copilot-cli': { command: 'copilot', args: ['--mcp'] },
  'external': { command: '', args: [] },
}
