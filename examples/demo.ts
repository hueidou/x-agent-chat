import { RaftChatServer } from '../src/server/ChatServer.js'
import { RaftServer } from '../src/models/Server.js'
import { AgentDaemon } from '../src/daemon/Daemon.js'

async function main() {
  console.log()
  console.log('╔══════════════════════════════════════╗')
  console.log('║      Raft Core Demo — Human & AI     ║')
  console.log('║      Agent Collaboration Platform     ║')
  console.log('╚══════════════════════════════════════╝')

  // ─── 1. Start Server ───
  const chat = new RaftChatServer({
    serverName: 'My Dev Team',
    ownerId: 'user-1',
  })
  await chat.start()
  console.log(`\n📡 Server started:`)
  console.log(`   Name: ${chat.server.getInfo().server.name}`)
  console.log(`   Daemon: ${chat.daemon.getUrl()}`)
  console.log(`   #Default channel: all`)

  // ─── 2. Create Agent ───
  const alice = await chat.createAgent(
    'Alice',
    'Senior backend developer, expert in TypeScript and Rust',
    'opencode'
  )
  console.log(`\n🤖 Agent created: ${alice.name}`)
  console.log(`   ID: ${alice.id}`)
  console.log(`   Handle: ${alice.handle}`)
  console.log(`   Runtime: ${alice.runtime}`)
  console.log(`   Initial status: ${alice.status}`)

  const bob = await chat.createAgent(
    'Bob',
    'QA engineer, writes tests and reviews code',
    'claude-code'
  )
  console.log(`\n🤖 Agent created: ${bob.name}`)
  console.log(`   ID: ${bob.id}`)
  console.log(`   Handle: ${bob.handle}`)
  console.log(`   Runtime: ${bob.runtime}`)

  // ─── 3. Create Task ───
  console.log(`\n📋 Creating tasks...`)
  const task1 = chat.createTask(
    'Refactor auth module',
    'Extract authentication logic into a separate service class. Add unit tests.',
    [alice.id]
  )
  console.log(`   📌 "${task1.title}" [${task1.status}]`)
  console.log(`   Assigned: ${alice.name}`)

  const task2 = chat.createTask(
    'Add CI pipeline',
    'Set up GitHub Actions for automated testing and deployment',
    [bob.id]
  )
  console.log(`   📌 "${task2.title}" [${task2.status}]`)
  console.log(`   Assigned: ${bob.name}`)

  // ─── 4. Agent claim task ───
  console.log(`\n👋 Alice claiming task...`)
  chat.server.claimTask(task1.id, alice.id)
  chat.server.updateAgentStatus(alice.id, 'busy')
  console.log(`   ${alice.name} status: busy`)
  console.log(`   Task "${task1.title}" → ${chat.server.listTasks()[0].status}`)

  // ─── 5. Send messages + @mentions ───
  console.log(`\n💬 Sending messages...`)
  let msg = chat.sendMessage('owner', 'all', 'Hey @Alice, can you review PR #42?')
  console.log(`   👤 owner → #all: "${msg?.content}"`)
  if (msg?.mentions.length) console.log(`   Mentions: ${msg.mentions.join(', ')}`)

  msg = chat.sendMessage('owner', 'all', '@Bob please run the test suite on latest build')
  console.log(`   👤 owner → #all: "${msg?.content}"`)
  if (msg?.mentions.length) console.log(`   Mentions: ${msg.mentions.join(', ')}`)

  msg = chat.sendMessage('owner', 'all', 'Team standup at 10am tomorrow')
  console.log(`   👤 owner → #all: "${msg?.content}"`)

  // Alice replies
  msg = chat.sendMessage('owner', 'all', '@Alice also update the API docs when you finish')
  console.log(`   👤 owner → #all: "${msg?.content}"`)

  // ─── 6. View channel messages ───
  const channels = chat.server.listChannels()
  const allChan = channels[0]
  const msgs = chat.server.getMessages(allChan.id)
  console.log(`\n📜 #${allChan.name} channel messages (total ${msgs.length}):`)
  for (const m of msgs) {
    const mentions = m.mentions.length ? ` [mentions: ${m.mentions.join(', ')}]` : ''
    console.log(`   [${m.sender.handle}] ${m.content}${mentions}`)
  }

  // ─── 7. View Agent status ───
  console.log(`\n📊 Current Agent status:`)
  for (const a of chat.server.listAgents()) {
    console.log(`   ${a.name} (${a.handle}): ${a.status} | Runtime: ${a.runtime}`)
  }

  console.log(`\n📊 Current tasks:`)
  for (const t of chat.server.listTasks()) {
    const assignee = t.assignedTo?.length ? ` → ${chat.server.listAgents().find(a => a.id === t.assignedTo![0])?.name ?? 'unknown'}` : ''
    console.log(`   📌 "${t.title}" [${t.status}]${assignee}`)
  }

  // ─── 8. Demo complete ───
  await chat.stop()
  console.log(`\n✅ Demo complete, Server closed.`)
}

main().catch(console.error)
