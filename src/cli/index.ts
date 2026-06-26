#!/usr/bin/env node
import { Command } from 'commander'
import { FileStore } from '../store/FileStore.js'
import { v4 as uuid } from 'uuid'
import { RuntimeType, TaskStatus } from '../types/index.js'

const program = new Command()
const store = new FileStore('default')

program
  .name('raft')
  .description('Raft Core CLI — Human and AI Agent collaboration platform')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize Server')
  .argument('[name]', 'Server name', 'My Team')
  .action((name: string) => {
    if (store.getServer()) {
      console.log(`Server already exists: ${store.getServer()!.name}`)
      return
    }
    store.setServer({
      id: uuid(),
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      createdAt: new Date(),
      ownerId: 'cli-user',
    })
    store.addMember({
      id: 'cli-user', name: 'Admin', type: 'human',
      handle: 'admin', role: 'owner', joinedAt: new Date(),
    })
    store.addChannel({
      id: store.genChannelId(), serverId: store.getServer()!.id,
      name: 'all', type: 'public', createdAt: new Date(),
      memberIds: ['cli-user'], isDefault: true,
    })
    console.log(`✅ Server "${name}" initialized`)
  })

program
  .command('server')
  .description('View Server info')
  .action(() => {
    const s = store.getServer()
    if (!s) { console.log('❌ Not initialized, please run raft init first'); return }
    console.log(`Server: ${s.name} (${s.slug})`)
    console.log(`ID:     ${s.id}`)
    console.log(`Members: ${store.getMembers().filter(m => m.type === 'human').length} humans`)
    console.log(`Agents:  ${store.getAgents().length}`)
    console.log(`Channels: ${store.getChannels().length}`)
    console.log(`Messages: ${store.getMessages(store.getChannels()[0]?.id ?? '').length}`)
    console.log(`Tasks:   ${store.getTasks().length}`)
  })

// ─── agent ───
program
  .command('agent:create')
  .description('Create Agent')
  .argument('<name>', 'Name')
  .argument('<description>', 'Description')
  .option('-r, --runtime <runtime>', 'Runtime', 'opencode')
  .action((name: string, description: string, opt: { runtime: string }) => {
    if (!store.getServer()) { console.log('❌ Please run raft init first'); return }
    const handle = `@${name.toLowerCase().replace(/\s+/g, '')}`
    store.addAgent({
      id: store.genAgentId(),
      serverId: store.getServer()!.id,
      name, handle, description,
      runtime: opt.runtime as RuntimeType,
      computerId: 'local',
      status: 'idle',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {},
    })
    store.addMember({
      id: handle.replace('@', ''),
      name, type: 'agent',
      handle, role: 'member', joinedAt: new Date(),
    })
    console.log(`✅ Agent "${name}" (${handle}) created, runtime: ${opt.runtime}`)
  })

program
  .command('agent:list')
  .description('List Agents')
  .action(() => {
    const agents = store.getAgents()
    if (!agents.length) { console.log('No agents yet'); return }
    console.log(`Agent (${agents.length}):`)
    for (const a of agents) {
      console.log(`   ${a.handle.padEnd(14)} ${a.status.padEnd(8)} ${a.runtime.padEnd(14)} ${a.description}`)
    }
  })

program
  .command('agent:status')
  .description('View/modify Agent status')
  .argument('<handle>', 'e.g. @alice')
  .argument('[status]', 'New status')
  .action((handle: string, status?: string) => {
    const agent = store.getAgentByHandle(handle)
    if (!agent) { console.log(`❌ Not found: ${handle}`); return }
    if (status) {
      store.updateAgent(agent.id, { status: status as any })
      console.log(`✅ ${agent.name} → ${status}`)
    } else {
      console.log(`${agent.name} (${agent.handle}): ${agent.status}`)
    }
  })

// ─── channel ───
program
  .command('channel:create')
  .description('Create channel')
  .argument('<name>', 'Channel name')
  .action((name: string) => {
    if (!store.getServer()) { console.log('❌ Please run raft init first'); return }
    store.addChannel({
      id: store.genChannelId(),
      serverId: store.getServer()!.id,
      name, type: 'public',
      createdAt: new Date(),
      memberIds: [],
      isDefault: false,
    })
    console.log(`✅ Channel #${name} created`)
  })

program
  .command('channel:list')
  .description('List channels')
  .action(() => {
    const channels = store.getChannels()
    if (!channels.length) { console.log('No channels yet'); return }
    for (const c of channels) {
      console.log(`   #${c.name.padEnd(16)} ${c.type}   ${c.isDefault ? '(default)' : ''}`)
    }
  })

// ─── message ───
program
  .command('message:send')
  .description('Send message')
  .argument('<channel>', 'Channel name')
  .argument('<content>', 'Content')
  .option('-a, --as <handle>', 'Sender', 'admin')
  .action((channelName: string, content: string, opt: { as: string }) => {
    const channel = store.getChannel(channelName)
    if (!channel) { console.log(`❌ Channel not found: #${channelName}`); return }
    const lookup = opt.as.replace('@', '')
    const sender = store.getMemberByHandle(lookup) ?? store.getMember(lookup)
      ?? store.getAgents().find(a => a.handle === `@${lookup}` || a.id === lookup)
    if (!sender) { console.log(`❌ Sender not found: ${opt.as}`); return }

    const mentions = store.getAgents()
      .filter(a => content.includes(a.handle))
      .map(a => a.handle)

    const isAgent = 'runtime' in sender
    store.addMessage({
      id: store.genMessageId(),
      channelId: channel.id,
      serverId: store.getServer()!.id,
      sender: {
        id: sender.id,
        name: sender.name,
        type: isAgent ? 'agent' : (sender as any).type ?? 'human',
        handle: 'handle' in sender ? (sender as any).handle : opt.as,
        role: 'member',
        joinedAt: new Date(),
      },
      content,
      mentions,
      attachments: [],
      reactions: [],
      createdAt: new Date(),
    })

    // wake mentioned agents
    for (const m of mentions) {
      const agent = store.getAgentByHandle(m)
      if (agent) store.updateAgent(agent.id, { status: 'active', lastActiveAt: new Date() })
    }

    const mentionStr = mentions.length ? ` [mentions: ${mentions.join(', ')}]` : ''
    console.log(`✅ Sent to #${channelName}${mentionStr}`)
  })

program
  .command('message:list')
  .description('View messages')
  .argument('[channel]', 'Channel name', 'all')
  .option('-n, --limit <n>', 'Count', '20')
  .action((channelName: string, opt: { limit: string }) => {
    const ch = store.getChannel(channelName)
    if (!ch) { console.log(`❌ Channel not found: #${channelName}`); return }
    const msgs = store.getMessages(ch.id).slice(-parseInt(opt.limit))
    if (!msgs.length) { console.log(`#${channelName} no messages`); return }
    console.log(`#${channelName} (${msgs.length} messages):`)
    for (const m of msgs) {
      const mt = m.mentions.length ? ` [${m.mentions.join(', ')}]` : ''
      console.log(`   [${m.sender.handle}] ${m.content}${mt}`)
    }
  })

// ─── task ───
program
  .command('task:create')
  .description('Create task')
  .argument('<title>', 'Title')
  .argument('<description>', 'Description')
  .option('-a, --assign <handles>', 'Assign to Agent (comma separated)')
  .action((title: string, description: string, opt: { assign?: string }) => {
    if (!store.getServer()) { console.log('❌ Please run raft init first'); return }
    const assignedTo = opt.assign
      ? opt.assign.split(',').map(h => h.trim()).map(h => store.getAgentByHandle(h)?.id).filter(Boolean) as string[]
      : undefined
    store.addTask({
      id: store.genTaskId(),
      serverId: store.getServer()!.id,
      title, description,
      status: 'pending',
      createdBy: 'cli-user',
      assignedTo,
      priority: 'medium',
      tags: [],
      createdAt: new Date(),
    })
    console.log(`✅ Task created: "${title}" [pending]`)
  })

program
  .command('task:list')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status')
  .action((opt: { status?: string }) => {
    let tasks = store.getTasks()
    if (opt.status) tasks = tasks.filter(t => t.status === opt.status)
    if (!tasks.length) { console.log('No tasks yet'); return }
    console.log(`Tasks (${tasks.length}):`)
    for (const t of tasks) {
      const assignee = t.assignedTo?.length
        ? ` → ${t.assignedTo.map(id => store.getAgent(id)?.name ?? id).join(',')}`
        : ''
      console.log(`   [${t.status.padEnd(10)}] "${t.title}" (${t.id})${assignee}`)
    }
  })

program
  .command('task:claim')
  .description('Claim task')
  .argument('<task-id>', 'Task ID')
  .argument('<agent-handle>', 'Agent handle')
  .action((taskId: string, handle: string) => {
    const agent = store.getAgentByHandle(handle)
    if (!agent) { console.log(`❌ Agent not found: ${handle}`); return }
    const task = store.getTask(taskId)
    if (!task) { console.log(`❌ Task not found: ${taskId}`); return }
    if (task.status !== 'pending') { console.log(`❌ Task status is ${task.status}, cannot claim`); return }
    store.updateTask(taskId, { status: 'claimed', claimedBy: agent.id, claimedAt: new Date() })
    store.updateAgent(agent.id, { status: 'busy' })
    console.log(`✅ ${agent.name} claimed task: "${task.title}"`)
  })

program
  .command('task:done')
  .description('Complete task')
  .argument('<task-id>', 'Task ID')
  .action((id: string) => {
    const t = store.getTask(id)
    if (!t) { console.log(`❌ Task not found: ${id}`); return }
    store.updateTask(id, { status: 'completed', completedAt: new Date() })
    console.log(`✅ Task completed: "${t.title}"`)
  })

program.parseAsync(process.argv).catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
