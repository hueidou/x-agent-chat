import { EventEmitter } from 'events'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import {
  AgentConfig, AgentStatus, RuntimeType,
  WakeRequest, WakeResponse, ActivityEvent,
} from '../types/index.js'
import { RuntimeManager, MCPRuntimeAdapter, RUNTIME_COMMANDS } from '../runtime/AgentRuntime.js'

interface DaemonOptions {
  host?: string
  port?: number
  token?: string
}

interface RegisteredAgent {
  config: AgentConfig
  pid?: number
  startedAt: Date
}

export class AgentDaemon extends EventEmitter {
  private runtimeManager: RuntimeManager
  private agents = new Map<string, RegisteredAgent>()
  private httpServer: ReturnType<typeof createServer> | null = null
  private options: DaemonOptions

  constructor(options: DaemonOptions = {}) {
    super()
    this.runtimeManager = new RuntimeManager()
    this.options = {
      host: options.host ?? '127.0.0.1',
      port: options.port ?? 0,
      token: options.token,
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = createServer((req, res) => this.handleRequest(req, res))
      this.httpServer.unref()
      this.httpServer.listen(this.options.port, this.options.host, () => {
        const addr = this.httpServer!.address()
        if (typeof addr === 'object' && addr) {
          this.options.port = addr.port
        }
        this.emit('started', { url: this.getUrl() })
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    for (const [id] of this.agents) {
      try { await this.runtimeManager.stopAgent(id) } catch {}
    }
    this.agents.clear()

    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.closeAllConnections?.()
        this.httpServer.close(() => resolve())
        setTimeout(() => resolve(), 2000)
      } else {
        resolve()
      }
    })
  }

  getUrl(): string {
    return `http://${this.options.host}:${this.options.port}`
  }

  async registerAgent(config: Omit<AgentConfig, 'id' | 'serverId' | 'createdAt' | 'lastActiveAt' | 'status'> & { serverId: string }): Promise<AgentConfig> {
    const agent: AgentConfig = {
      ...config,
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      serverId: config.serverId,
      status: 'idle',
      createdAt: new Date(),
      lastActiveAt: new Date(),
    }

    const cmd = RUNTIME_COMMANDS[config.runtime]
    const adapter = new MCPRuntimeAdapter(agent.id, config.runtime, cmd.command, cmd.args)
    this.runtimeManager.registerAdapter(agent.id, adapter)

    this.agents.set(agent.id, {
      config: agent,
      startedAt: new Date(),
    })

    try {
      await this.runtimeManager.startAgent(agent)
    } catch (err) {
      this.emit('agent:error', { agentId: agent.id, error: err })
    }
    this.emit('agent:started', agent)
    return agent
  }

  async unregisterAgent(agentId: string): Promise<void> {
    await this.runtimeManager.stopAgent(agentId)
    this.agents.delete(agentId)
    this.emit('agent:stopped', agentId)
  }

  listAgents(): AgentConfig[] {
    return [...this.agents.values()].map(a => a.config)
  }

  getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId)?.config
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json')

    if (this.options.token) {
      const auth = req.headers['x-raft-bridge-token']
      if (auth !== this.options.token) {
        res.statusCode = 401
        res.end(JSON.stringify({ error: 'unauthorized' }))
        return
      }
    }

    try {
      if (req.method === 'POST' && req.url === '/wake') {
        await this.handleWake(req, res)
      } else if (req.method === 'POST' && req.url === '/activity') {
        await this.handleActivity(req, res)
      } else if (req.method === 'GET' && req.url?.startsWith('/activity/drain')) {
        this.handleDrain(req, res)
      } else {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'not_found' }))
      }
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'internal_error' }))
    }
  }

  private async handleWake(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readBody(req)
    const wakeReq: WakeRequest = JSON.parse(body)
    const agent = this.agents.get(wakeReq.agentId)
    if (!agent) {
      res.statusCode = 404
      res.end(JSON.stringify({ ok: false, failureClass: 'no_session', reason: 'agent_not_found' }))
      return
    }
    await this.runtimeManager.wake(agent.config.id, wakeReq.messageId)
    const response: WakeResponse = { ok: true }
    res.end(JSON.stringify(response))
  }

  private async handleActivity(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readBody(req)
    const event: ActivityEvent = JSON.parse(body)
    this.emit('activity', event)
    res.statusCode = 202
    res.end(JSON.stringify({ ok: true }))
  }

  private handleDrain(_req: IncomingMessage, res: ServerResponse): void {
    res.end(JSON.stringify({ events: [], dropped: 0 }))
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}
