export interface ServerInfo {
  server: { id: string; name: string; slug: string; createdAt: string; ownerId: string }
  members: Member[]
  agentCount: number; humanCount: number; channelCount: number
  messageCount: number; taskCount: number; initialized: boolean
}

export interface Member {
  id: string; name: string; type: 'human' | 'agent'
  handle: string; description?: string; role: string; joinedAt: string
}

export interface Agent {
  id: string; serverId: string; name: string; handle: string
  description: string; runtime: string; computerId: string
  status: string; createdAt: string; lastActiveAt: string; metadata: Record<string,string>
}

export interface Channel {
  id: string; serverId: string; name: string; type: string
  createdAt: string; memberIds: string[]; isDefault: boolean
  lastMessage?: Message | null
}

export interface Message {
  id: string; channelId: string; serverId: string
  sender: Member; content: string; mentions: string[]
  attachments: any[]; reactions: any[]; createdAt: string
}

export interface Task {
  id: string; serverId: string; title: string; description: string
  status: string; createdBy: string; claimedBy?: string
  assignedTo?: string[]; assignedNames?: string[]
  priority: string; tags: string[]; createdAt: string
  claimedAt?: string; completedAt?: string
}
