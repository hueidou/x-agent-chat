export type TaskStatus = 'pending' | 'claimed' | 'in_progress' | 'review' | 'completed' | 'cancelled'

export interface TaskConfig {
  id: string
  serverId: string
  channelId?: string
  title: string
  description: string
  status: TaskStatus
  createdBy: string
  claimedBy?: string
  assignedTo?: string[]
  priority: 'low' | 'medium' | 'high' | 'urgent'
  tags: string[]
  createdAt: Date
  claimedAt?: Date
  completedAt?: Date
  dueDate?: Date
}

export interface TaskSummary {
  id: string
  title: string
  status: TaskStatus
  priority: string
  claimedBy?: string
  tags: string[]
  createdAt: Date
}
