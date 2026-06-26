export type ChannelType = 'public' | 'private' | 'dm'

export interface ChannelConfig {
  id: string
  serverId: string
  name: string
  type: ChannelType
  createdAt: Date
  memberIds: string[]
  isDefault: boolean
  topic?: string
}

export interface ChannelSummary {
  id: string
  name: string
  type: ChannelType
  memberCount: number
  lastMessageAt?: Date
  unreadCount: number
}
