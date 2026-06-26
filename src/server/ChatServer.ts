import { EventEmitter } from 'events'
import { RaftServer } from '../models/Server.js'
import { AgentDaemon } from '../daemon/Daemon.js'
import { RuntimeManager } from '../runtime/AgentRuntime.js'
import { WakeBridgeServer } from '../runtime/WakeBridge.js'
import {
  Message, TaskConfig, AgentConfig,
  RuntimeType, Member,
} from '../types/index.js'

interface ChatServerConfig {
  serverName: string
  ownerId: string
  daemonPort?: number
}

export class RaftChatServer extends EventEmitter {
  server: RaftServer
  daemon: AgentDaemon
  runtimeManager: RuntimeManager

  constructor(config: ChatServerConfig) {
    super()
    this.server = new RaftServer(config.serverName, config.ownerId)
    this.runtimeManager = new RuntimeManager()
    this.daemon = new AgentDaemon({
      port: config.daemonPort ?? 0,
      token: this.generateToken(),
    })

    this.daemon.on('agent:started', (agent: AgentConfig) => {
      this.emit('agent:started', agent)
    })

    this.daemon.on('agent:stopped', (agentId: string) => {
      this.emit('agent:stopped', agentId)
    })

    this.daemon.on('activity', (event: any) => {
      this.emit('activity', event)
    })

    this.daemon.on('agent:error', (payload: { agentId: string; error: Error }) => {
      this.emit('agent:error', payload)
    })
  }

  async start(): Promise<void> {
    await this.daemon.start()
    this.emit('started', { url: this.daemon.getUrl() })
  }

  async stop(): Promise<void> {
    await this.daemon.stop()
    this.emit('stopped')
  }

  async createAgent(
    name: string,
    description: string,
    runtime: RuntimeType
  ): Promise<AgentConfig> {
    const handle = `@${name.toLowerCase().replace(/\s+/g, '')}`
    const agent = this.server.addAgent({
      name,
      handle,
      description,
      runtime,
      computerId: 'local',
      metadata: {},
    })

    await this.daemon.registerAgent({
      name: agent.name,
      handle: agent.handle,
      description: agent.description,
      runtime: agent.runtime,
      computerId: agent.computerId,
      metadata: agent.metadata,
      serverId: agent.serverId,
    })

    return agent
  }

  sendMessage(
    senderHandle: string,
    channelName: string,
    content: string
  ): Message | null {
    const channel = [...this.server['store'].channels.values()]
      .find(c => c.name === channelName && c.serverId === this.server.config.id)
    if (!channel) return null

    const sender = this.server.listMembers()
      .find(m => m.handle === senderHandle)
    if (!sender) return null

    const mentions = extractMentions(content, this.server.listAgents())
    const msg = this.server.sendMessage(sender.id, channel.id, content, { mentions })

    if (msg && mentions.length > 0) {
      for (const mention of mentions) {
        const agent = this.server.listAgents().find(a => a.handle === mention)
        if (agent) {
          this.daemon.getAgent(agent.id)
          this.server.updateAgentStatus(agent.id, 'active')
        }
      }
    }

    return msg
  }

  createTask(
    title: string,
    description: string,
    assignedTo?: string[]
  ): TaskConfig {
    return this.server.createTask({
      title,
      description,
      createdBy: this.server.config.ownerId,
      assignedTo,
      priority: 'medium',
      tags: [],
    })
  }

  private generateToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    return token
  }
}

function extractMentions(content: string, agents: AgentConfig[]): string[] {
  const mentioned: string[] = []
  for (const agent of agents) {
    if (content.includes(agent.handle)) {
      mentioned.push(agent.handle)
    }
  }
  return mentioned
}
