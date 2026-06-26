async function runTest() {
  const PASS = '✅'
  const FAIL = '❌'
  let passed = 0
  let failed = 0

  function assert(condition: boolean, msg: string) {
    if (condition) { passed++; console.log(`  ${PASS} ${msg}`) }
    else { failed++; console.log(`  ${FAIL} ${msg}`) }
  }

  const { MemoryStore } = await import('../src/store/MemoryStore.js')
  const { RaftServer } = await import('../src/models/Server.js')
  const { WakeBridgeServer, ActivityQueue, buildWakeContent, buildWakeMeta } = await import('../src/runtime/WakeBridge.js')
  const { RaftChatServer } = await import('../src/server/ChatServer.js')
  const { AgentDaemon } = await import('../src/daemon/Daemon.js')
  const { execSync } = await import('child_process')

  // ============================
  console.log('\n[1] MemoryStore basic operations')
  // ============================
  {
    const store = new MemoryStore()
    store.addServer({ id: 's1', name: 'Test', slug: 'test', createdAt: new Date(), ownerId: 'u1' })
    store.addMember('s1', { id: 'u1', name: 'Alice', type: 'human', handle: '@alice', role: 'member', joinedAt: new Date() })
    store.addChannel({ id: 'c1', serverId: 's1', name: 'general', type: 'public', createdAt: new Date(), memberIds: ['u1'], isDefault: false })
    store.addMessage({
      id: 'm1', channelId: 'c1', serverId: 's1',
      sender: { id: 'u1', name: 'Alice', type: 'human', handle: '@alice', role: 'member', joinedAt: new Date() },
      content: 'hello', mentions: [], attachments: [], reactions: [], createdAt: new Date(),
    })
    const msgs = store.getChannelMessages('c1')
    assert(msgs.length === 1, 'store and retrieve message')
    assert(msgs[0].content === 'hello', 'message content preserved')
  }

  // ============================
  console.log('\n[2] RaftServer core model')
  // ============================
  {
    const server = new RaftServer('Test Team', 'owner-1', 'test-team')

    const info = server.getInfo()
    assert(info.server.name === 'Test Team', 'server name correct')
    assert(info.server.slug === 'test-team', 'slug correct')
    assert(info.channelCount === 1, 'default #all channel auto-created')
    assert(info.humanCount === 1, 'owner auto-added')

    server.addChannel({ id: 'dev-chan', serverId: info.server.id, name: 'dev', type: 'public', memberIds: ['owner-1'] })
    assert(server.listChannels('owner-1').length === 2, 'channels listed')

    const msg = server.sendMessage('owner-1', 'dev-chan', 'Hello team!')
    assert(msg !== null, 'sendMessage succeeds')
    assert(msg!.content === 'Hello team!', 'message content matches')

    const msgs = server.getMessages('dev-chan')
    assert(msgs.length === 1, 'messages retrieved by channel ID')
  }

  // ============================
  console.log('\n[3] Task lifecycle')
  // ============================
  {
    const server = new RaftServer('Task Test', 'u1')
    const task = server.createTask({
      title: 'Fix bug',
      description: 'Fix login bug',
      createdBy: 'u1',
      priority: 'high',
      tags: ['bug'],
      assignedTo: [],
    })
    assert(task.status === 'pending', 'task starts as pending')

    const claimed = server.claimTask(task.id, 'agent-1')
    assert(claimed !== null, 'task can be claimed')
    assert(claimed!.status === 'claimed', 'task status becomes claimed')

    const done = server.updateTaskStatus(task.id, 'completed')
    assert(done?.status === 'completed', 'task can be completed')
    assert(done?.completedAt !== undefined, 'completedAt set')
  }

  // ============================
  console.log('\n[4] Agent lifecycle')
  // ============================
  {
    const server = new RaftServer('Agent Test', 'u1')
    const agent = server.addAgent({
      name: 'Helper',
      handle: '@helper',
      description: 'A helpful agent',
      runtime: 'opencode',
      computerId: 'local',
      metadata: {},
    })
    assert(agent.status === 'idle', 'agent starts idle')
    assert(agent.name === 'Helper', 'agent name set')
    assert(agent.handle === '@helper', 'agent handle set')

    server.updateAgentStatus(agent.id, 'active')
    assert(server.listAgents().find(a => a.id === agent.id)?.status === 'active', 'agent status updated')

    const agents = server.listAgents()
    assert(agents.length === 1, 'agent listed')
    assert(agents[0].runtime === 'opencode', 'runtime persisted')
  }

  // ============================
  console.log('\n[5] @mentions wake agents')
  // ============================
  {
    const server = new RaftServer('Mention Test', 'u1')
    const agent = server.addAgent({
      name: 'Watcher', handle: '@watcher', description: 'Watches for mentions',
      runtime: 'opencode', computerId: 'local', metadata: {},
    })

    const devChan = server.addChannel({ id: 'dev-chan-2', serverId: (server as any)['config'].id, name: 'dev-2', type: 'public', memberIds: ['u1'] })

    server.sendMessage('u1', devChan.id, 'Hey @watcher check this out', { mentions: ['@watcher'] })
    const watcher = server.listAgents().find(a => a.id === agent.id)
    assert(watcher?.status === 'active', 'mentioned agent becomes active')
  }

  // ============================
  console.log('\n[6] WakeBridge and ActivityQueue')
  // ============================
  {
    const bridge = new WakeBridgeServer(
      {
        onWake: async (req) => {
          assert(req.schema === 'raft-channel-wake.v1', 'wake request schema correct')
          assert(req.messageId.length > 0, 'messageId present')
          return { ok: true, runtimeSession: 'test-session' }
        },
        onActivity: async () => {},
      },
      { agentId: 'agent-1', profile: 'test', debounceMs: 0 }
    )

    bridge.enableActivityTracking()

    const resp = await bridge.handleWake('test', 'msg-1')
    assert(resp.ok === true, 'wake response ok')
    assert(resp.runtimeSession === 'session-agent-1', 'runtime session returned')

    const content = buildWakeContent({} as any)
    assert(content.includes('raft message check'), 'wake content instructs CLI usage')

    const meta = buildWakeMeta({ messageId: 'msg-1', agentId: 'agent-1', attemptId: 'a1', eventId: 'e1' } as any)
    assert(meta.raft_message_id === 'msg-1', 'wake meta contains message ID')
    assert(meta.raft_agent_id === 'agent-1', 'wake meta contains agent ID')
  }

  // ============================
  console.log('\n[7] ActivityQueue drain and cap')
  // ============================
  {
    const q = new ActivityQueue(5)
    for (let i = 0; i < 10; i++) {
      q.push({
        schema: 'raft-activity.v1',
        eventId: `e${i}`,
        sessionId: 's1',
        hookEventName: 'PostToolUse',
        status: 'ok',
        occurredAt: new Date().toISOString(),
      })
    }
    assert(q.size === 5, 'queue caps at 5')
    assert(q.droppedSinceDrain === 5, 'dropped counter: 5 overflow')

    const drain = q.drain()
    assert(drain.events.length === 5, 'drain returns up to 5 events')
    assert(drain.dropped === 5, 'drain reports dropped count')
  }

  // ============================
  console.log('\n[8] RaftChatServer integration')
  // ============================
  {
    const chat = new RaftChatServer({
      serverName: 'Integration Test',
      ownerId: 'test-owner',
      daemonPort: 0,
    })

    await chat.start()
    assert(chat.server.getInfo().server.name === 'Integration Test', 'chat server started')

    const agent = await chat.createAgent('OpenCode Agent', 'Test agent with opencode runtime', 'opencode')
    assert(agent.name === 'OpenCode Agent', 'agent created via chat server')
    assert(agent.runtime === 'opencode', 'runtime set to opencode')

    const msg = chat.sendMessage('owner', 'all', 'Hello @OpenCode Agent')
    assert(msg !== null, 'message sent via chat')

    await chat.stop()
    assert(true, 'chat server stopped cleanly')
  }

  // ============================
  console.log('\n[9] RuntimeManager + Daemon')
  // ============================
  {
    const daemon = new AgentDaemon({ port: 0, token: 'test-token' })
    await daemon.start()
    assert(daemon.getUrl().startsWith('http://127.0.0.1:'), 'daemon HTTP server started')

    await daemon.registerAgent({
      name: 'Runtime Agent', handle: '@runtime', description: 'Runtime test',
      runtime: 'opencode', computerId: 'local', metadata: {},
      serverId: 's1',
    })
    assert(daemon.listAgents().length === 1, 'agent registered in daemon')

    await daemon.stop()
    assert(daemon.listAgents().length === 0, 'daemon stopped and agents cleared')
  }

  // ============================
  console.log('\n[10] Opencode CLI availability')
  // ============================
  {
    try {
      const out = execSync('opencode --version 2>&1', { encoding: 'utf8' })
      assert(out.includes('.'), `opencode CLI works: ${out.trim()}`)
    } catch {
      assert(false, 'opencode CLI not found')
    }
  }

  // ============================
  console.log('\n' + '='.repeat(50))
  console.log(`Results: ${PASS} ${passed} passed, ${failed > 0 ? FAIL : ''} ${failed} failed`)
  console.log('='.repeat(50))

  process.exit(failed > 0 ? 1 : 0)
}

runTest().catch(err => {
  console.error('Test suite error:', err)
  process.exit(1)
})
