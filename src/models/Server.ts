import { v4 as uuid } from 'uuid'
import { MemoryStore } from '../store/MemoryStore.js'
import {
  ServerConfig, ServerInfo, Member,
  ChannelConfig, ChannelType, ChannelSummary,
  Message, Thread, TaskConfig, TaskStatus,
  AgentConfig, AgentStatus, RuntimeType,
} from '../types/index.js'

export class RaftServer {
  private store: MemoryStore
  config: ServerConfig

  constructor(name: string, ownerId: string, slug?: string) {
    this.store = new MemoryStore()
    this.config = {
      id: uuid(),
      name,
      slug: slug ?? name.toLowerCase().replace(/\s+/g, '-'),
      createdAt: new Date(),
      ownerId,
    }
    this.store.addServer(this.config)

    this.addMember({
      id: ownerId,
      name: 'Owner',
      type: 'human',
      handle: 'owner',
      role: 'owner',
      joinedAt: new Date(),
    })

    this.addChannel({
      id: uuid(),
      serverId: this.config.id,
      name: 'all',
      type: 'public',
      memberIds: [ownerId],
      isDefault: true,
    })
  }

  getInfo(): ServerInfo {
    return {
      server: this.config,
      members: this.listMembers(),
      channelCount: this.store.channels.size,
      agentCount: [...this.store.agents.values()].filter(a => a.serverId === this.config.id).length,
      humanCount: [...this.store.members.values()].filter(m => m.type === 'human').length,
    }
  }

  addMember(member: Omit<Member, 'joinedAt'> & { joinedAt?: Date }): Member {
    const full: Member = { ...member, joinedAt: member.joinedAt ?? new Date() }
    this.store.addMember(this.config.id, full)
    return full
  }

  listMembers(): Member[] {
    return [...this.store.members.values()]
  }

  // --- Channel ---
  addChannel(config: Omit<ChannelConfig, 'createdAt' | 'isDefault'> & { isDefault?: boolean }): ChannelConfig {
    const channel: ChannelConfig = {
      ...config,
      serverId: this.config.id,
      createdAt: new Date(),
      isDefault: config.isDefault ?? false,
    }
    this.store.addChannel(channel)
    return channel
  }

  listChannels(memberId?: string): ChannelSummary[] {
    return [...this.store.channels.values()]
      .filter(c => c.serverId === this.config.id && (!memberId || c.memberIds.includes(memberId)))
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        memberCount: c.memberIds.length,
        unreadCount: 0,
      }))
  }

  // --- Message ---
  sendMessage(
    senderId: string,
    channelId: string,
    content: string,
    options?: { threadId?: string; mentions?: string[] }
  ): Message | null {
    const channel = this.store.channels.get(channelId)
    if (!channel || channel.serverId !== this.config.id) return null
    const sender = this.store.members.get(senderId)
    if (!sender) return null

    const msg: Message = {
      id: uuid(),
      channelId,
      serverId: this.config.id,
      sender,
      content,
      threadId: options?.threadId,
      mentions: options?.mentions ?? [],
      attachments: [],
      reactions: [],
      createdAt: new Date(),
    }
    this.store.addMessage(msg)

    for (const mention of msg.mentions) {
      const target = this.store.getAgentByHandle(this.config.id, mention)
      if (target) this.wakeAgent(target.id, msg)
    }

    return msg
  }

  getMessages(channelId: string, limit = 50): Message[] {
    return this.store.getChannelMessages(channelId, limit)
  }

  createThread(rootMessageId: string): Thread | null {
    const root = this.store.messages.get(rootMessageId)
    if (!root) return null
    const thread: Thread = {
      id: uuid(),
      channelId: root.channelId,
      rootMessageId,
      rootMessage: root,
      messages: [root],
      createdAt: new Date(),
      replyCount: 0,
    }
    this.store.threads.set(thread.id, thread)
    return thread
  }

  // --- Task ---
  createTask(config: Omit<TaskConfig, 'id' | 'serverId' | 'status' | 'createdAt'>): TaskConfig {
    const task: TaskConfig = {
      ...config,
      id: uuid(),
      serverId: this.config.id,
      status: 'pending',
      createdAt: new Date(),
    }
    this.store.addTask(task)

    if (task.assignedTo) {
      for (const agentId of task.assignedTo) {
        this.wakeAgent(agentId, undefined, task)
      }
    }

    return task
  }

  claimTask(taskId: string, agentId: string): TaskConfig | null {
    const task = this.store.tasks.get(taskId)
    if (!task || task.status !== 'pending') return null
    task.status = 'claimed'
    task.claimedBy = agentId
    task.claimedAt = new Date()
    return task
  }

  updateTaskStatus(taskId: string, status: TaskStatus): TaskConfig | null {
    const task = this.store.tasks.get(taskId)
    if (!task) return null
    task.status = status
    if (status === 'completed') task.completedAt = new Date()
    return task
  }

  listTasks(status?: TaskStatus): TaskConfig[] {
    return this.store.getServerTasks(this.config.id, status)
  }

  // --- Agent ---
  addAgent(config: Omit<AgentConfig, 'id' | 'serverId' | 'createdAt' | 'lastActiveAt' | 'status'>): AgentConfig {
    const agent: AgentConfig = {
      ...config,
      id: uuid(),
      serverId: this.config.id,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      status: 'idle',
    }
    this.store.agents.set(agent.id, agent)
    this.store.addMember(this.config.id, {
      id: agent.id,
      name: agent.name,
      type: 'agent',
      handle: agent.handle,
      description: agent.description,
      role: 'member',
      joinedAt: new Date(),
    })
    return agent
  }

  listAgents(): AgentConfig[] {
    return [...this.store.agents.values()].filter(a => a.serverId === this.config.id)
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.store.agents.get(agentId)
    if (agent) {
      agent.status = status
      agent.lastActiveAt = new Date()
    }
  }

  private wakeAgent(agentId: string, message?: Message, task?: TaskConfig): void {
    const agent = this.store.agents.get(agentId)
    if (!agent) return
    if (agent.status !== 'offline') {
      agent.status = 'active'
      agent.lastActiveAt = new Date()
    }
  }
}
