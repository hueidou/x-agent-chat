#!/usr/bin/env node
import { Command } from 'commander'
import { FileStore } from '../store/FileStore.js'
import { v4 as uuid } from 'uuid'
import { RuntimeType, TaskStatus } from '../types/index.js'

const program = new Command()
const store = new FileStore('default')

program
  .name('raft')
  .description('Raft Core CLI — 人类与 AI Agent 协作平台')
  .version('0.1.0')

program
  .command('init')
  .description('初始化 Server')
  .argument('[name]', 'Server 名称', 'My Team')
  .action((name: string) => {
    if (store.getServer()) {
      console.log(`Server 已存在: ${store.getServer()!.name}`)
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
    console.log(`✅ Server "${name}" 已初始化`)
  })

program
  .command('server')
  .description('查看 Server 信息')
  .action(() => {
    const s = store.getServer()
    if (!s) { console.log('❌ 未初始化，请先运行 raft init'); return }
    console.log(`Server: ${s.name} (${s.slug})`)
    console.log(`ID:     ${s.id}`)
    console.log(`成员:   ${store.getMembers().filter(m => m.type === 'human').length} 人`)
    console.log(`Agent:  ${store.getAgents().length} 个`)
    console.log(`频道:   ${store.getChannels().length} 个`)
    console.log(`消息:   ${store.getMessages(store.getChannels()[0]?.id ?? '').length} 条`)
    console.log(`任务:   ${store.getTasks().length} 个`)
  })

// ─── agent ───
program
  .command('agent:create')
  .description('创建 Agent')
  .argument('<name>', '名称')
  .argument('<description>', '描述')
  .option('-r, --runtime <runtime>', '运行时', 'opencode')
  .action((name: string, description: string, opt: { runtime: string }) => {
    if (!store.getServer()) { console.log('❌ 请先运行 raft init'); return }
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
    console.log(`✅ Agent "${name}" (${handle}) 已创建, 运行时: ${opt.runtime}`)
  })

program
  .command('agent:list')
  .description('列出 Agent')
  .action(() => {
    const agents = store.getAgents()
    if (!agents.length) { console.log('暂无 Agent'); return }
    console.log(`Agent (${agents.length}):`)
    for (const a of agents) {
      console.log(`   ${a.handle.padEnd(14)} ${a.status.padEnd(8)} ${a.runtime.padEnd(14)} ${a.description}`)
    }
  })

program
  .command('agent:status')
  .description('查看/修改 Agent 状态')
  .argument('<handle>', '如 @alice')
  .argument('[status]', '新状态')
  .action((handle: string, status?: string) => {
    const agent = store.getAgentByHandle(handle)
    if (!agent) { console.log(`❌ 未找到: ${handle}`); return }
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
  .description('创建频道')
  .argument('<name>', '频道名称')
  .action((name: string) => {
    if (!store.getServer()) { console.log('❌ 请先运行 raft init'); return }
    store.addChannel({
      id: store.genChannelId(),
      serverId: store.getServer()!.id,
      name, type: 'public',
      createdAt: new Date(),
      memberIds: [],
      isDefault: false,
    })
    console.log(`✅ 频道 #${name} 已创建`)
  })

program
  .command('channel:list')
  .description('列出频道')
  .action(() => {
    const channels = store.getChannels()
    if (!channels.length) { console.log('暂无频道'); return }
    for (const c of channels) {
      console.log(`   #${c.name.padEnd(16)} ${c.type}   ${c.isDefault ? '(默认)' : ''}`)
    }
  })

// ─── message ───
program
  .command('message:send')
  .description('发送消息')
  .argument('<channel>', '频道名')
  .argument('<content>', '内容')
  .option('-a, --as <handle>', '发送者', 'admin')
  .action((channelName: string, content: string, opt: { as: string }) => {
    const channel = store.getChannel(channelName)
    if (!channel) { console.log(`❌ 未找到频道: #${channelName}`); return }
    const lookup = opt.as.replace('@', '')
    const sender = store.getMemberByHandle(lookup) ?? store.getMember(lookup)
      ?? store.getAgents().find(a => a.handle === `@${lookup}` || a.id === lookup)
    if (!sender) { console.log(`❌ 未找到发送者: ${opt.as}`); return }

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

    const mentionStr = mentions.length ? ` [提及: ${mentions.join(', ')}]` : ''
    console.log(`✅ 已发送到 #${channelName}${mentionStr}`)
  })

program
  .command('message:list')
  .description('查看消息')
  .argument('[channel]', '频道名', 'all')
  .option('-n, --limit <n>', '数量', '20')
  .action((channelName: string, opt: { limit: string }) => {
    const ch = store.getChannel(channelName)
    if (!ch) { console.log(`❌ 未找到频道: #${channelName}`); return }
    const msgs = store.getMessages(ch.id).slice(-parseInt(opt.limit))
    if (!msgs.length) { console.log(`#${channelName} 暂无消息`); return }
    console.log(`#${channelName} (${msgs.length} 条):`)
    for (const m of msgs) {
      const mt = m.mentions.length ? ` [${m.mentions.join(', ')}]` : ''
      console.log(`   [${m.sender.handle}] ${m.content}${mt}`)
    }
  })

// ─── task ───
program
  .command('task:create')
  .description('创建任务')
  .argument('<title>', '标题')
  .argument('<description>', '描述')
  .option('-a, --assign <handles>', '指派给 Agent (逗号分隔)')
  .action((title: string, description: string, opt: { assign?: string }) => {
    if (!store.getServer()) { console.log('❌ 请先运行 raft init'); return }
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
    console.log(`✅ 任务已创建: "${title}" [pending]`)
  })

program
  .command('task:list')
  .description('列出任务')
  .option('-s, --status <status>', '筛选状态')
  .action((opt: { status?: string }) => {
    let tasks = store.getTasks()
    if (opt.status) tasks = tasks.filter(t => t.status === opt.status)
    if (!tasks.length) { console.log('暂无任务'); return }
    console.log(`任务 (${tasks.length}):`)
    for (const t of tasks) {
      const assignee = t.assignedTo?.length
        ? ` → ${t.assignedTo.map(id => store.getAgent(id)?.name ?? id).join(',')}`
        : ''
      console.log(`   [${t.status.padEnd(10)}] "${t.title}" (${t.id})${assignee}`)
    }
  })

program
  .command('task:claim')
  .description('认领任务')
  .argument('<task-id>', '任务 ID')
  .argument('<agent-handle>', 'Agent 称呼')
  .action((taskId: string, handle: string) => {
    const agent = store.getAgentByHandle(handle)
    if (!agent) { console.log(`❌ 未找到 Agent: ${handle}`); return }
    const task = store.getTask(taskId)
    if (!task) { console.log(`❌ 未找到任务: ${taskId}`); return }
    if (task.status !== 'pending') { console.log(`❌ 任务状态为 ${task.status}，无法认领`); return }
    store.updateTask(taskId, { status: 'claimed', claimedBy: agent.id, claimedAt: new Date() })
    store.updateAgent(agent.id, { status: 'busy' })
    console.log(`✅ ${agent.name} 已认领任务: "${task.title}"`)
  })

program
  .command('task:done')
  .description('完成任务')
  .argument('<task-id>', '任务 ID')
  .action((id: string) => {
    const t = store.getTask(id)
    if (!t) { console.log(`❌ 未找到任务: ${id}`); return }
    store.updateTask(id, { status: 'completed', completedAt: new Date() })
    console.log(`✅ 任务已完成: "${t.title}"`)
  })

program.parseAsync(process.argv).catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
