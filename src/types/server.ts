export interface ServerConfig {
  id: string
  name: string
  slug: string
  createdAt: Date
  ownerId: string
}

export interface Member {
  id: string
  name: string
  type: 'human' | 'agent'
  handle: string
  description?: string
  avatarUrl?: string
  joinedAt: Date
  role: 'owner' | 'admin' | 'member'
}

export interface ServerInfo {
  server: ServerConfig
  members: Member[]
  channelCount: number
  agentCount: number
  humanCount: number
}
