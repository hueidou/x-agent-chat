import http from 'http'

const BASE = 'http://localhost:4173'
let passed = 0
let failed = 0

function check(desc, ok) {
  if (ok) { passed++; console.log(`  ✅ ${desc}`) }
  else { failed++; console.log(`  ❌ ${desc}`) }
}

function fetch(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: () => data }))
    }).on('error', reject)
  })
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body)
    const req = http.request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: () => JSON.parse(data) }))
    })
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

async function main() {
  console.log('\n═══ 1. Server Connectivity ═══')
  const s = await fetch('/api/server')
  const serverData = JSON.parse(s.body())
  check('HTTP 200', s.status === 200)
  check('JSON Content-Type', s.type?.includes('json'))
  check('Server name', serverData.server?.name === 'My Team')

  console.log('\n═══ 2. Create Agent ═══')
  const r1 = await post('/api/agents', { name: 'Alice', description: 'Developer', runtime: 'opencode' })
  check('Alice created 201', r1.status === 201)
  const alice = r1.body()
  check(`Handle: ${alice.handle}`, alice.handle === '@alice')

  const r2 = await post('/api/agents', { name: 'Bob', description: 'QA', runtime: 'claude-code' })
  check('Bob created 201', r2.status === 201)

  console.log('\n═══ 3. Send message with @mention ═══')
  const r3 = await post('/api/channels/all/messages', {
    content: 'Hey @alice what is 2+2? Reply with just the number.',
    senderHandle: 'admin'
  })
  check('Message sent 201', r3.status === 201)
  const msg = r3.body()
  check(`@alice recognized: ${msg.mentions?.join(',')}`, msg.mentions?.includes('@alice'))
  check('No server-side template reply', !msg.replies || msg.replies?.length === 0)

  console.log('\n═══ 4. Agent Status Change ═══')
  const agents = await fetch('/api/agents')
  const agentsData = JSON.parse(agents.body())
  const aliceNow = agentsData.find(a => a.name === 'Alice')
  check(`Alice status: ${aliceNow?.status}`, aliceNow?.status === 'active')

  console.log('\n═══ 5. SSE Endpoint ═══')
  const sseResult = await new Promise((resolve) => {
    const req = http.get(`${BASE}/api/events?agent=@alice`, res => {
      const headers = res.headers
      res.once('data', () => { req.destroy(); resolve({ status: res.statusCode, type: headers['content-type'] }) })
      setTimeout(() => { req.destroy(); resolve({ status: res.statusCode, type: headers['content-type'] }) }, 2000)
    })
    req.on('error', () => resolve({ status: 0, type: '' }))
  })
  check('SSE 200', sseResult.status === 200)
  check('SSE Content-Type: text/event-stream', sseResult.type?.includes('text/event-stream'))

  console.log('\n═══ 6. Message list has no template replies ═══')
  const msgs = await fetch('/api/channels/all/messages')
  const msgsData = JSON.parse(msgs.body())
  check(`Message count: ${msgsData.length}`, msgsData.length >= 1)
  const agentReplies = msgsData.filter(m => m.sender.type === 'agent')
  check('No Agent auto-reply (waiting for Worker)', agentReplies.length === 0)

  console.log('\n═══ 7. Agent RuntimeAdapter ═══')
  const runtimeRes = await fetch('/api/agents')
  const runtimeData = JSON.parse(runtimeRes.body())
  const runtimes = [...new Set(runtimeData.map(a => a.runtime))]
  check(`Runtime types: ${runtimes.join(', ')}`, runtimes.includes('opencode') && runtimes.includes('claude-code'))

  console.log(`\n══════════════════════════════════════`)
  console.log(`  Total: ${passed} ✅   ${failed} ❌  Pass rate: ${(passed / (passed + failed) * 100).toFixed(0)}%`)
  console.log(`══════════════════════════════════════`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
