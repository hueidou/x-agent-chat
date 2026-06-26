import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import {
  ServerConfig, Member, ChannelConfig,
  Message, TaskConfig, AgentConfig,
} from '../types/index.js'

interface PersistedData {
  server: ServerConfig | null
  members: Member[]
  channels: ChannelConfig[]
  messages: Message[]
  tasks: TaskConfig[]
  agents: AgentConfig[]
  nextChannelId: number
  nextMessageId: number
  nextTaskId: number
  nextAgentId: number
}

export class FileStore {
  private dir: string
  private file: string
  private data: PersistedData

  constructor(name = 'default') {
    this.dir = join(homedir(), '.raft', 'servers')
    this.file = join(this.dir, `${name}.json`)
    this.data = this.load()
  }

  private load(): PersistedData {
    if (existsSync(this.file)) {
      try {
        const raw = readFileSync(this.file, 'utf-8')
        const parsed = JSON.parse(raw)
        return {
          server: parsed.server ?? null,
          members: parsed.members ?? [],
          channels: parsed.channels ?? [],
          messages: parsed.messages ?? [],
          tasks: parsed.tasks ?? [],
          agents: parsed.agents ?? [],
          nextChannelId: parsed.nextChannelId ?? 1,
          nextMessageId: parsed.nextMessageId ?? 1,
          nextTaskId: parsed.nextTaskId ?? 1,
          nextAgentId: parsed.nextAgentId ?? 1,
        }
      } catch { /* corrupted file, start fresh */ }
    }
    return {
      server: null,
      members: [],
      channels: [],
      messages: [],
      tasks: [],
      agents: [],
      nextChannelId: 1,
      nextMessageId: 1,
      nextTaskId: 1,
      nextAgentId: 1,
    }
  }

  private save(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  getServer(): ServerConfig | null { return this.data.server }
  setServer(s: ServerConfig): void { this.data.server = s; this.save() }

  getMembers(): Member[] { return this.data.members }
  addMember(m: Member): void { this.data.members.push(m); this.save() }
  getMember(id: string): Member | undefined { return this.data.members.find(m => m.id === id) }
  getMemberByHandle(handle: string): Member | undefined { return this.data.members.find(m => m.handle === handle) }

  getChannels(): ChannelConfig[] { return this.data.channels }
  addChannel(c: ChannelConfig): void { this.data.channels.push(c); this.save() }
  getChannel(name: string): ChannelConfig | undefined { return this.data.channels.find(c => c.name === name) }
  getChannelById(id: string): ChannelConfig | undefined { return this.data.channels.find(c => c.id === id) }
  genChannelId(): string { return `ch-${this.data.nextChannelId++}` }

  getMessages(channelId: string): Message[] { return this.data.messages.filter(m => m.channelId === channelId) }
  addMessage(m: Message): void { this.data.messages.push(m); this.save() }
  genMessageId(): string { return `msg-${this.data.nextMessageId++}` }

  getAgents(): AgentConfig[] { return this.data.agents }
  addAgent(a: AgentConfig): void { this.data.agents.push(a); this.save() }
  getAgentByHandle(handle: string): AgentConfig | undefined { return this.data.agents.find(a => a.handle === handle) }
  getAgent(id: string): AgentConfig | undefined { return this.data.agents.find(a => a.id === id) }
  updateAgent(id: string, upd: Partial<AgentConfig>): void {
    const idx = this.data.agents.findIndex(a => a.id === id)
    if (idx >= 0) { this.data.agents[idx] = { ...this.data.agents[idx], ...upd }; this.save() }
  }
  genAgentId(): string { return `agent-${this.data.nextAgentId++}` }

  getTasks(): TaskConfig[] { return this.data.tasks }
  addTask(t: TaskConfig): void { this.data.tasks.push(t); this.save() }
  getTask(id: string): TaskConfig | undefined { return this.data.tasks.find(t => t.id === id) }
  updateTask(id: string, upd: Partial<TaskConfig>): void {
    const idx = this.data.tasks.findIndex(t => t.id === id)
    if (idx >= 0) { this.data.tasks[idx] = { ...this.data.tasks[idx], ...upd }; this.save() }
  }
  genTaskId(): string { return `task-${this.data.nextTaskId++}` }
}
