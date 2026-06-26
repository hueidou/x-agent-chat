import { RaftChatServer } from '../src/server/ChatServer.js'
import { RaftServer } from '../src/models/Server.js'
import { AgentDaemon } from '../src/daemon/Daemon.js'

async function main() {
  console.log()
  console.log('╔══════════════════════════════════════╗')
  console.log('║      Raft Core 演示 — 人类与 AI      ║')
  console.log('║      Agent 协作平台                   ║')
  console.log('╚══════════════════════════════════════╝')

  // ─── 1. 启动 Server ───
  const chat = new RaftChatServer({
    serverName: 'My Dev Team',
    ownerId: 'user-1',
  })
  await chat.start()
  console.log(`\n📡 Server 已启动:`)
  console.log(`   名称: ${chat.server.getInfo().server.name}`)
  console.log(`   Daemon: ${chat.daemon.getUrl()}`)
  console.log(`   #默认频道: all`)

  // ─── 2. 创建 Agent ───
  const alice = await chat.createAgent(
    'Alice',
    'Senior backend developer, expert in TypeScript and Rust',
    'opencode'
  )
  console.log(`\n🤖 Agent 已创建: ${alice.name}`)
  console.log(`   ID: ${alice.id}`)
  console.log(`   称呼: ${alice.handle}`)
  console.log(`   运行时: ${alice.runtime}`)
  console.log(`   初始状态: ${alice.status}`)

  const bob = await chat.createAgent(
    'Bob',
    'QA engineer, writes tests and reviews code',
    'claude-code'
  )
  console.log(`\n🤖 Agent 已创建: ${bob.name}`)
  console.log(`   ID: ${bob.id}`)
  console.log(`   称呼: ${bob.handle}`)
  console.log(`   运行时: ${bob.runtime}`)

  // ─── 3. 创建 Task ───
  console.log(`\n📋 创建任务...`)
  const task1 = chat.createTask(
    'Refactor auth module',
    'Extract authentication logic into a separate service class. Add unit tests.',
    [alice.id]
  )
  console.log(`   📌 "${task1.title}" [${task1.status}]`)
  console.log(`   指派: ${alice.name}`)

  const task2 = chat.createTask(
    'Add CI pipeline',
    'Set up GitHub Actions for automated testing and deployment',
    [bob.id]
  )
  console.log(`   📌 "${task2.title}" [${task2.status}]`)
  console.log(`   指派: ${bob.name}`)

  // ─── 4. Agent 认领任务 ───
  console.log(`\n👋 Alice 认领任务...`)
  chat.server.claimTask(task1.id, alice.id)
  chat.server.updateAgentStatus(alice.id, 'busy')
  console.log(`   ${alice.name} 状态: busy`)
  console.log(`   任务 "${task1.title}" → ${chat.server.listTasks()[0].status}`)

  // ─── 5. 发送消息 + @mentions ───
  console.log(`\n💬 发送消息...`)
  let msg = chat.sendMessage('owner', 'all', 'Hey @Alice, can you review PR #42?')
  console.log(`   👤 owner → #all: "${msg?.content}"`)
  if (msg?.mentions.length) console.log(`   提及: ${msg.mentions.join(', ')}`)

  msg = chat.sendMessage('owner', 'all', '@Bob please run the test suite on latest build')
  console.log(`   👤 owner → #all: "${msg?.content}"`)
  if (msg?.mentions.length) console.log(`   提及: ${msg.mentions.join(', ')}`)

  msg = chat.sendMessage('owner', 'all', 'Team standup at 10am tomorrow')
  console.log(`   👤 owner → #all: "${msg?.content}"`)

  // Alice 回复
  msg = chat.sendMessage('owner', 'all', '@Alice also update the API docs when you finish')
  console.log(`   👤 owner → #all: "${msg?.content}"`)

  // ─── 6. 查看频道消息 ───
  const channels = chat.server.listChannels()
  const allChan = channels[0]
  const msgs = chat.server.getMessages(allChan.id)
  console.log(`\n📜 #${allChan.name} 频道消息 (共 ${msgs.length} 条):`)
  for (const m of msgs) {
    const mentions = m.mentions.length ? ` [提及: ${m.mentions.join(', ')}]` : ''
    console.log(`   [${m.sender.handle}] ${m.content}${mentions}`)
  }

  // ─── 7. 查看 Agent 状态 ───
  console.log(`\n📊 当前 Agent 状态:`)
  for (const a of chat.server.listAgents()) {
    console.log(`   ${a.name} (${a.handle}): ${a.status} | 运行时: ${a.runtime}`)
  }

  console.log(`\n📊 当前任务:`)
  for (const t of chat.server.listTasks()) {
    const assignee = t.assignedTo?.length ? ` → ${chat.server.listAgents().find(a => a.id === t.assignedTo![0])?.name ?? 'unknown'}` : ''
    console.log(`   📌 "${t.title}" [${t.status}]${assignee}`)
  }

  // ─── 8. 演示完毕 ───
  await chat.stop()
  console.log(`\n✅ 演示结束，Server 已关闭。`)
}

main().catch(console.error)
