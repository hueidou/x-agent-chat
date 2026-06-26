import express from 'express'
import cors from 'cors'
import { FileStore } from '../src/store/FileStore.js'
import { v4 as uuid } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'
import { RuntimeType, Member } from '../src/types/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const store = new FileStore('default')
const PORT = parseInt(process.env.PORT || '4173', 10)

app.use(cors())
app.use(express.json())

// ── SSE ──
const sseClients = new Map<string, Set<express.Response>>()
const frontendClients = new Set<express.Response>()

function sseSend(agentHandle: string, data: object): void {
  const clients = sseClients.get(agentHandle)
  if (!clients) return
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const res of clients) {
    try { res.write(msg) } catch { clients.delete(res) }
  }
}

function broadcastToFrontend(data: object): void {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const res of frontendClients) {
    try { res.write(msg) } catch { frontendClients.delete(res) }
  }
}

function ensureInit(res: express.Response): boolean {
  if (!store.getServer()) {
    store.setServer({
      id: uuid(), name: 'My Team',
      slug: 'my-team', createdAt: new Date(), ownerId: 'admin',
    })
    store.addMember({
      id: 'admin', name: 'Admin', type: 'human',
      handle: 'admin', role: 'owner', joinedAt: new Date(),
    })
    store.addChannel({
      id: store.genChannelId(), serverId: store.getServer()!.id,
      name: 'all', type: 'public', createdAt: new Date(),
      memberIds: ['admin'], isDefault: true,
    })
    return true
  }
  return false
}

// ── Server ──
app.get('/api/server', (_req, res) => {
  ensureInit(res)
  const s = store.getServer()!
  const members = store.getMembers()
  res.json({
    server: s,
    members,
    agentCount: store.getAgents().length,
    humanCount: members.filter(m => m.type === 'human').length,
    channelCount: store.getChannels().length,
    messageCount: store.getChannels().reduce((sum, ch) => sum + store.getMessages(ch.id).length, 0),
    taskCount: store.getTasks().length,
    initialized: true,
  })
})

// ── Members ──
app.get('/api/members', (_req, res) => { res.json(store.getMembers()) })

// ── Agents ──
app.get('/api/agents', (_req, res) => { res.json(store.getAgents()) })

app.post('/api/agents', (req, res) => {
  const { name, description, runtime = 'opencode' } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  ensureInit(res)
  const handle = `@${name.toLowerCase().replace(/\s+/g, '')}`
  store.addAgent({
    id: store.genAgentId(), serverId: store.getServer()!.id,
    name, handle, description: description || '',
    runtime: runtime as RuntimeType, computerId: 'local',
    status: 'idle', createdAt: new Date(),
    lastActiveAt: new Date(), metadata: {},
  })
  store.addMember({
    id: handle.replace('@', ''), name, type: 'agent',
    handle, role: 'member', joinedAt: new Date(),
  })
  res.status(201).json(store.getAgentByHandle(handle))
})

app.patch('/api/agents/:handle', (req, res) => {
  const agent = store.getAgentByHandle(req.params.handle)
  if (!agent) return res.status(404).json({ error: 'agent not found' })
  store.updateAgent(agent.id, req.body)
  res.json(store.getAgent(agent.id))
})

// ── Channels ──
app.get('/api/channels', (_req, res) => {
  const channels = store.getChannels().map(c => ({
    ...c,
    lastMessage: store.getMessages(c.id).slice(-1)[0] || null,
  }))
  res.json(channels)
})

app.post('/api/channels', (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  ensureInit(res)
  store.addChannel({
    id: store.genChannelId(), serverId: store.getServer()!.id,
    name, type: 'public' as const, createdAt: new Date(),
    memberIds: [], isDefault: false,
  })
  res.status(201).json(store.getChannel(name))
})

// ── Messages ──
app.get('/api/channels/:channelName/messages', (req, res) => {
  const ch = store.getChannel(req.params.channelName)
  if (!ch) return res.status(404).json({ error: 'channel not found' })
  const limit = parseInt(req.query.limit as string) || 100
  res.json(store.getMessages(ch.id).slice(-limit))
})

app.post('/api/channels/:channelName/messages', (req, res) => {
  const ch = store.getChannel(req.params.channelName)
  if (!ch) return res.status(404).json({ error: 'channel not found' })
  const { content, senderHandle = 'admin' } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })

  const lookup = senderHandle.replace('@', '')
  const sender: Member | undefined =
    store.getMemberByHandle(lookup) ?? store.getMember(lookup)
  if (!sender) return res.status(400).json({ error: `sender ${senderHandle} not found` })

  const mentions = store.getAgents()
    .filter(a => content.includes(a.handle))
    .map(a => a.handle)

  const msg = {
    id: store.genMessageId(), channelId: ch.id, serverId: store.getServer()!.id,
    sender,
    content, mentions,
    attachments: [], reactions: [], createdAt: new Date(),
  }
  store.addMessage(msg)

  for (const m of mentions) {
    const agent = store.getAgentByHandle(m)
    if (agent) store.updateAgent(agent.id, { status: 'active', lastActiveAt: new Date() })
    sseSend(m, { type: 'mention', messageId: msg.id, channelName: ch.name, content })
  }

  broadcastToFrontend({ type: 'message', channelName: ch.name, messageId: msg.id })

  res.status(201).json(msg)
})

// ── Agent SSE ──
app.get('/api/events', (req, res) => {
  const handle = req.query.agent as string
  if (!handle) return res.status(400).json({ error: '?agent=@xxx required' })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(`data: ${JSON.stringify({ type: 'connected', agent: handle })}\n\n`)

  if (!sseClients.has(handle)) sseClients.set(handle, new Set())
  sseClients.get(handle)!.add(res)

  const keepalive = setInterval(() => { try { res.write(': keepalive\n\n') } catch {} }, 15000)

  req.on('close', () => {
    clearInterval(keepalive)
    sseClients.get(handle)?.delete(res)
    if (sseClients.get(handle)?.size === 0) sseClients.delete(handle)
  })
})

// ── Frontend SSE (real-time message push) ──
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
  frontendClients.add(res)

  const keepalive = setInterval(() => { try { res.write(': keepalive\n\n') } catch {} }, 15000)

  req.on('close', () => {
    clearInterval(keepalive)
    frontendClients.delete(res)
  })
})

// ── Agent streaming reply push ──
app.post('/api/channels/:channelName/stream', (req, res) => {
  const { agentHandle, agentName, content, status } = req.body
  broadcastToFrontend({
    type: 'agent_stream',
    channelName: req.params.channelName,
    agentHandle,
    agentName,
    content,
    status,
  })
  res.json({ ok: true })
})

// ── Tasks ──
app.get('/api/tasks', (req, res) => {
  let tasks = store.getTasks()
  if (req.query.status) tasks = tasks.filter(t => t.status === req.query.status)
  res.json(tasks.map(t => ({
    ...t,
    assignedNames: (t.assignedTo || []).map((id: string) => store.getAgent(id)?.name || id),
  })))
})

app.post('/api/tasks', (req, res) => {
  const { title, description, assignHandles } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })
  ensureInit(res)
  const assignedTo = assignHandles
    ? assignHandles.map((h: string) => store.getAgentByHandle(h)?.id).filter(Boolean)
    : undefined
  const taskId = store.genTaskId()
  store.addTask({
    id: taskId, serverId: store.getServer()!.id,
    title, description: description || '',
    status: 'pending' as const, createdBy: 'admin',
    assignedTo, priority: 'medium' as const,
    tags: [], createdAt: new Date(),
  })
  res.status(201).json(store.getTask(taskId))
  // Note: store.genTaskId() advances counter; we already called addTask with a computed id
})

app.patch('/api/tasks/:id', (req, res) => {
  const task = store.getTask(req.params.id)
  if (!task) return res.status(404).json({ error: 'task not found' })
  store.updateTask(req.params.id, req.body)
  if (req.body.status === 'claimed' && req.body.claimedBy) {
    store.updateAgent(req.body.claimedBy, { status: 'busy' })
  }
  if (req.body.status === 'completed') {
    store.updateTask(req.params.id, { completedAt: new Date() })
  }
  res.json(store.getTask(req.params.id))
})

// ── Static files ──
const distPath = path.resolve(process.cwd(), 'web', 'dist')
app.use(express.static(distPath))
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Raft API server running at http://localhost:${PORT}`)
})
