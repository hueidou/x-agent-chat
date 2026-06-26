import { RaftChatServer } from '../src/server/ChatServer.js'

async function main() {
  const chat = new RaftChatServer({
    serverName: 'My Team',
    ownerId: 'user-1',
  })

  await chat.start()
  console.log('--- Raft Server Started ---')

  const channels = chat.server.listChannels()
  const allChannel = channels[0]
  console.log(`Channel: #${allChannel.name} (${allChannel.id})`)

  const agent1 = await chat.createAgent(
    'Alice',
    'Senior developer, expert in TypeScript and Rust',
    'opencode'
  )
  console.log(`Agent created: ${agent1.name} (${agent1.handle})`)

  const agent2 = await chat.createAgent(
    'Bob',
    'QA engineer, writes tests and reviews code',
    'claude-code'
  )
  console.log(`Agent created: ${agent2.name} (${agent2.handle})`)

  const task = chat.createTask(
    'Refactor auth module',
    'Extract authentication logic into a separate service class. Add unit tests.',
    [agent1.id]
  )
  console.log(`Task created: "${task.title}" [${task.status}]`)

  chat.server.claimTask(task.id, agent1.id)
  console.log(`Task claimed by ${agent1.name}: ${chat.server.listTasks()[0].status}`)

  let msg = chat.sendMessage(
    'owner',
    'all',
    'Hey @alice, can you review the PR #42 when you get a chance?'
  )
  console.log(`Message from owner: "${msg?.content}"`)

  msg = chat.sendMessage(
    'owner',
    'all',
    '@bob please run the test suite on the latest build'
  )
  console.log(`Message from owner: "${msg?.content}"`)

  chat.server.updateAgentStatus(agent2.id, 'busy')
  const bobStatus = chat.server.listAgents().find(a => a.id === agent2.id)?.status
  console.log(`Bob status: ${bobStatus}`)

  const msgs = chat.server.getMessages(allChannel.id)
  console.log(`\nMessages in #${allChannel.name}: ${msgs.length}`)
  for (const m of msgs) {
    console.log(`  [${m.sender.handle}] ${m.content}`)
  }

  await chat.stop()
  console.log('\n--- Raft Server Stopped ---')
}

main().catch(console.error)
