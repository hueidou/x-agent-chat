import { Member } from './server.js'

export interface Message {
  id: string
  channelId: string
  serverId: string
  sender: Member
  content: string
  threadId?: string
  parentMessageId?: string
  mentions: string[]
  attachments: Attachment[]
  reactions: Reaction[]
  createdAt: Date
  editedAt?: Date
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
}

export interface Reaction {
  emoji: string
  userIds: string[]
}

export interface Thread {
  id: string
  channelId: string
  rootMessageId: string
  rootMessage: Message
  messages: Message[]
  createdAt: Date
  replyCount: number
}

export interface MessageDelivery {
  messageId: string
  channelId: string
  channelName: string
  senderName: string
  content: string
  mentioned: boolean
}
