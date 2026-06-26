import type { ServerInfo, Agent, Channel, Message, Task } from './types'

const BASE = '/api'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`)
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`)
  return res.json()
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error) }
  return res.json()
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${url}: ${res.status}`)
  return res.json()
}

export const api = {
  server:        ()                     => get<ServerInfo>('/server'),
  agents:        ()                     => get<Agent[]>('/agents'),
  createAgent:   (n: string, d: string, r?: string) => post<Agent>('/agents', { name: n, description: d, runtime: r }),
  updateAgent:   (h: string, b: Partial<Agent>) => patch<Agent>(`/agents/${h}`, b),
  channels:      ()                     => get<Channel[]>('/channels'),
  createChannel: (n: string)           => post<Channel>('/channels', { name: n }),
  messages:      (ch: string)          => get<Message[]>(`/channels/${ch}/messages`),
  sendMessage:   (ch: string, content: string, sender?: string) => post<Message>(`/channels/${ch}/messages`, { content, senderHandle: sender }),
  tasks:         (status?: string)     => get<Task[]>(`/tasks${status ? `?status=${status}` : ''}`),
  createTask:    (t: string, d: string, a?: string[]) => post<Task>('/tasks', { title: t, description: d, assignHandles: a }),
  updateTask:    (id: string, b: Partial<Task>) => patch<Task>(`/tasks/${id}`, b),
}
