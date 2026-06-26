import {
  ServerConfig, Member, ChannelConfig,
  Message, Thread, TaskConfig, AgentConfig, AgentSession,
} from '../types/index.js'

export class MemoryStore {
  servers = new Map<string, ServerConfig>()
  members = new Map<string, Member>()
  channels = new Map<string, ChannelConfig>()
  messages = new Map<string, Message>()
  threads = new Map<string, Thread>()
  tasks = new Map<string, TaskConfig>()
  agents = new Map<string, AgentConfig>()
  agentSessions = new Map<string, AgentSession>()

  private channelMessages = new Map<string, string[]>()
  private serverChannels = new Map<string, string[]>()
  private serverMembers = new Map<string, string[]>()
  private serverTasks = new Map<string, string[]>()
  private channelMembers = new Map<string, string[]>()

  addServer(server: ServerConfig) {
    this.servers.set(server.id, server)
    this.serverChannels.set(server.id, [])
    this.serverMembers.set(server.id, [])
    this.serverTasks.set(server.id, [])
  }

  addMember(serverId: string, member: Member) {
    this.members.set(member.id, member)
    const members = this.serverMembers.get(serverId) ?? []
    members.push(member.id)
    this.serverMembers.set(serverId, members)
  }

  addChannel(channel: ChannelConfig) {
    this.channels.set(channel.id, channel)
    this.channelMessages.set(channel.id, [])
    this.channelMembers.set(channel.id, [...channel.memberIds])
    const channels = this.serverChannels.get(channel.serverId) ?? []
    channels.push(channel.id)
    this.serverChannels.set(channel.serverId, channels)
  }

  addMessage(message: Message) {
    this.messages.set(message.id, message)
    const msgs = this.channelMessages.get(message.channelId) ?? []
    msgs.push(message.id)
    this.channelMessages.set(message.channelId, msgs)
  }

  getChannelMessages(channelId: string, limit = 50, before?: string): Message[] {
    const ids = this.channelMessages.get(channelId) ?? []
    let slice = ids
    if (before) {
      const idx = ids.indexOf(before)
      if (idx > 0) slice = ids.slice(0, idx)
    }
    const selected = slice.slice(-limit)
    return selected.map(id => this.messages.get(id)!).filter(Boolean)
  }

  addTask(task: TaskConfig) {
    this.tasks.set(task.id, task)
    const tasks = this.serverTasks.get(task.serverId) ?? []
    tasks.push(task.id)
    this.serverTasks.set(task.serverId, tasks)
  }

  getServerTasks(serverId: string, status?: string): TaskConfig[] {
    const ids = this.serverTasks.get(serverId) ?? []
    return ids
      .map(id => this.tasks.get(id)!)
      .filter(t => t && (!status || t.status === status))
  }

  getAgentByHandle(serverId: string, handle: string): AgentConfig | undefined {
    for (const agent of this.agents.values()) {
      if (agent.serverId === serverId && agent.handle === handle) return agent
    }
    return undefined
  }

  getMemberInChannel(memberId: string, channelId: string): boolean {
    return this.channelMembers.get(channelId)?.includes(memberId) ?? false
  }
}
