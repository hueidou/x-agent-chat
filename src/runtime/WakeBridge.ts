import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { WakeRequest, WakeResponse, ActivityEvent, ActivityDrainResult } from '../types/index.js'

interface WakeBridgeOptions {
  agentId: string
  profile: string
  debounceMs?: number
  maxBatchSize?: number
}

interface WakeListener {
  onWake(request: WakeRequest): Promise<WakeResponse>
  onActivity(event: ActivityEvent): Promise<void>
}

export class DebouncedWakeNotifier {
  private pending: WakeRequest[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private debounceMs: number
  private maxBatchSize: number
  private notifier: (requests: WakeRequest[]) => Promise<void>

  constructor(
    notifier: (requests: WakeRequest[]) => Promise<void>,
    options?: { debounceMs?: number; maxBatchSize?: number }
  ) {
    this.notifier = notifier
    this.debounceMs = options?.debounceMs ?? 1000
    this.maxBatchSize = options?.maxBatchSize ?? 20
  }

  async notify(request: WakeRequest): Promise<void> {
    if (this.debounceMs === 0) {
      await this.notifier([request])
      return
    }

    if (this.pending.length === 0) {
      this.pending.push(request)
      await this.notifier([request])
      this.startTimer()
      return
    }

    this.pending.push(request)

    if (this.pending.length >= this.maxBatchSize) {
      await this.flush()
    }
  }

  private startTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), this.debounceMs)
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.pending.length === 0) return
    const batch = [...this.pending]
    this.pending = []
    await this.notifier(batch)
  }
}

export class ActivityQueue {
  private events: ActivityEvent[] = []
  private cap: number
  droppedSinceDrain = 0

  constructor(cap = 500) {
    this.cap = cap
  }

  push(event: ActivityEvent): void {
    if (this.events.length >= this.cap) {
      this.events.shift()
      this.droppedSinceDrain++
    }
    this.events.push(event)
  }

  drain(max = 200): ActivityDrainResult {
    const drained = this.events.splice(0, max)
    const result: ActivityDrainResult = {
      schema: 'raft-activity-drain.v1',
      events: drained,
      dropped: this.droppedSinceDrain,
    }
    this.droppedSinceDrain = 0
    return result
  }

  get size(): number {
    return this.events.length
  }
}

export class WakeBridgeServer {
  private notifier: DebouncedWakeNotifier
  private activityQueue: ActivityQueue | null
  private listener: WakeListener
  private options: WakeBridgeOptions

  constructor(
    listener: WakeListener,
    options: WakeBridgeOptions
  ) {
    this.listener = listener
    this.options = options
    this.activityQueue = null
    this.notifier = new DebouncedWakeNotifier(
      async (requests) => {
        for (const req of requests) {
          await this.listener.onWake(req)
        }
      },
      { debounceMs: options.debounceMs, maxBatchSize: options.maxBatchSize }
    )
  }

  enableActivityTracking(): void {
    this.activityQueue = new ActivityQueue()
  }

  async handleWake(profile: string, messageId: string): Promise<WakeResponse> {
    const request: WakeRequest = {
      schema: 'raft-channel-wake.v1',
      attemptId: randomUUID(),
      eventId: randomUUID(),
      messageId,
      agentId: this.options.agentId,
      profile,
      coreSessionId: randomUUID(),
      adapterInstance: 'default',
      occurredAt: new Date().toISOString(),
    }

    await this.notifier.notify(request)
    return { ok: true, runtimeSession: `session-${this.options.agentId}` }
  }

  async handleActivity(event: ActivityEvent): Promise<void> {
    if (!this.activityQueue) return
    this.activityQueue.push(event)
  }

  drainActivity(max?: number): ActivityDrainResult {
    return this.activityQueue?.drain(max) ?? {
      schema: 'raft-activity-drain.v1',
      events: [],
      dropped: 0,
    }
  }
}

export function buildWakeContent(request: WakeRequest): string {
  return `You have a new message from Raft. Run \`raft message check\` to pull the pending message.`
}

export function buildWakeMeta(request: WakeRequest): Record<string, string> {
  return {
    raft_message_id: request.messageId,
    raft_agent_id: request.agentId,
    raft_attempt_id: request.attemptId,
    raft_event_id: request.eventId,
  }
}
