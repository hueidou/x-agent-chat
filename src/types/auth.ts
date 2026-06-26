export interface SessionPrincipal {
  sub: string
  type: 'human' | 'agent'
  serverId: string
  serverSlug: string | null
  serverRole: 'owner' | 'admin' | 'member' | null
  name: string
  handle: string | null
  avatarUrl: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  scope: string
}

export interface RaftUserinfo {
  sub: string
  type: 'human' | 'agent'
  scope: string
  client_id: string
  client_name: string
  server_id: string
  server_slug: string | null
  server_role?: string | null
  preferred_username: string | null
  name: string
  avatar_url: string | null
  description: string | null
}

export interface SessionCookie {
  principal: SessionPrincipal
  exp: number
  signature: string
}
