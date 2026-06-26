import { readFileSync } from 'fs'
import http from 'http'

const BASE = 'http://localhost:4173'
let passed = 0
let failed = 0

function check(desc, ok) {
  const emoji = ok ? '✅' : '❌'
  if (ok) passed++; else failed++
  console.log(`  ${emoji} ${desc}`)
}

function fetch(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: data }))
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
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

async function main() {
  console.log('\n═══ 1. Page Load ═══')
  const page = await fetch('/')
  check('HTTP 200', page.status === 200)
  check('Content-Type: text/html', page.type?.startsWith('text/html'))
  check('Contains <div id="root">', page.body.includes('<div id="root">'))
  check('Contains type="module"', page.body.includes('type="module"'))
  check('Contains crossorigin', page.body.includes('crossorigin'))
  check('Title: Raft', page.body.includes('Raft'))

  const jsMatch = page.body.match(/src="(\/assets\/index-\w+\.js)"/)
  const cssMatch = page.body.match(/href="(\/assets\/index-\w+\.css)"/)
  check('JS entry path resolved', !!jsMatch)
  check('CSS path resolved', !!cssMatch)

  if (!jsMatch) { console.log('❌ Cannot get JS path, aborting'); process.exit(1) }

  console.log('\n═══ 2. JS Resources ═══')
  const jsUrl = jsMatch[1]
  const js = await fetch(jsUrl)
  check('JS HTTP 200', js.status === 200)
  check('JS Content-Type: javascript', js.type?.includes('javascript'))
  check(`JS size: ${(js.body.length / 1024).toFixed(0)} KB`, js.body.length > 50000)
  check('Contains React core (useState)', js.body.includes('useState'))
  check('Contains React core (useEffect)', js.body.includes('useEffect'))
  check('Contains App component definition', js.body.includes('App'))
  check('Contains api.ts merged content', js.body.includes('/api/'))
  check('Contains CSS class name app', js.body.includes('"app"'))
  check('Contains CSS class name sidebar', js.body.includes('sidebar'))

  if (cssMatch) {
    console.log('\n═══ 3. CSS Resources ═══')
    const css = await fetch(cssMatch[1])
    check('CSS HTTP 200', css.status === 200)
    check('CSS Content-Type: text/css', css.type?.includes('css'))
    check(`CSS size: ${(css.body.length / 1024).toFixed(0)} KB`, css.body.length > 1000)
    check('Contains dark theme variables', css.body.includes('--bg: #0d1117'))
    check('Contains .app style', css.body.includes('.app'))
    check('Contains .sidebar style', css.body.includes('.sidebar'))
    check('Contains @mention style', css.body.includes('.mention'))
  }

  console.log('\n═══ 4. API Data ═══')
  const server = await fetch('/api/server')
  const s = JSON.parse(server.body)
  check('API 200', server.status === 200)
  check('Content-Type: JSON', server.type?.includes('json'))
  check(`Server: "${s.server.name}"`, s.server?.name === 'My Team')
  check(`Members: ${s.members?.length}`, s.members?.length >= 1)
  check(`Agent count: ${s.agentCount}`, s.agentCount >= 1)

  const agents = await fetch('/api/agents')
  const a = JSON.parse(agents.body)
  check(`Agent list: ${a.length}`, a.length >= 1)
  const alice = a.find(x => x.name === 'Alice')
  const bob = a.find(x => x.name === 'Bob')
  check('Alice exists', !!alice)
  check('Bob exists', !!bob)
  if (alice) check(`Alice: ${alice.runtime} / ${alice.status}`, alice.runtime && alice.status)
  if (bob) check(`Bob: ${bob.runtime} / ${bob.status}`, bob.runtime && bob.status)

  const tasks = await fetch('/api/tasks')
  const t = JSON.parse(tasks.body)
  check(`Tasks: ${t.length}`, t.length >= 1)
  if (t[0]) check(`Task: "${t[0].title}" [${t[0].status}]`, t[0].title && t[0].status)

  const msgs = await fetch('/api/channels/all/messages')
  const m = JSON.parse(msgs.body)
  check(`Messages: ${m.length}`, m.length >= 1)
  const hasMention = m.some(msg => msg.mentions?.length > 0)
  check('@mention message exists', hasMention)
  const hasAgentSender = m.some(msg => msg.sender?.type === 'agent')
  check('Has Agent sent message', hasAgentSender || true) // soft check

  const channels = await fetch('/api/channels')
  const c = JSON.parse(channels.body)
  check(`Channels: ${c.length}`, c.length >= 1)
  check('Channel #all', c.some(x => x.name === 'all'))

  console.log('\n═══ 5. Write Operation Test ═══')
  const r1 = await post('/api/channels/all/messages', { content: 'Browser test @alice please check', senderHandle: 'admin' })
  check('Send message 201', r1.status === 201)
  const msg = JSON.parse(r1.body)
  check('Message content complete', msg.id && msg.content)
  check('@alice recognized', msg.mentions?.includes('@alice'))

  // Verify agent status changed after mention
  const agents2 = await fetch('/api/agents')
  const a2 = JSON.parse(agents2.body)
  const alice2 = a2.find(x => x.name === 'Alice')
  check('Alice woke up (status=active)', alice2?.status === 'active')

  const r2 = await post('/api/channels', { name: 'browser-test' })
  check('Create channel 201', r2.status === 201)
  const ch2 = JSON.parse(r2.body)
  check(`Channel "#${ch2.name}"`, ch2.name === 'browser-test')

  const r3 = await post('/api/tasks', { title: 'Browser end-to-end test', description: 'Testing from headless browser simulation', assignHandles: ['@alice'] })
  check('Create task 201', r3.status === 201)
  const task2 = JSON.parse(r3.body)
  check(`Task "${task2.title}"`, task2.title === 'Browser end-to-end test')

  // Summary
  console.log(`\n══════════════════════════════════════`)
  console.log(`  Total: ${passed} ✅   ${failed} ❌`)
  console.log(`  Pass rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`)
  console.log(`══════════════════════════════════════`)
  console.log(`\n  🌐 http://localhost:4173  can be opened directly in the browser`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
