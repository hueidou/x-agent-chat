export interface WakeRequest {
  schema: 'raft-channel-wake.v1'
  attemptId: string
  eventId: string
  messageId: string
  agentId: string
  profile: string
  coreSessionId: string
  adapterInstance: string
  occurredAt: string
}

export interface WakeResponse {
  ok: boolean
  runtimeSession?: string
  failureClass?: 'no_session' | 'busy' | 'injection_failed' | 'protocol_mismatch' | 'auth_revoked'
  reason?: string
  retryAfterMs?: number
}

export interface ActivityEvent {
  schema: 'raft-activity.v1'
  eventId: string
  sessionId: string
  hookEventName: string
  status: 'ok' | 'error'
  occurredAt: string
  toolName?: string
  toolInput?: string
  toolOutput?: string
  errorClass?: string
  truncated?: boolean
}

export interface ActivityDrainResult {
  schema: 'raft-activity-drain.v1'
  events: ActivityEvent[]
  dropped: number
}
