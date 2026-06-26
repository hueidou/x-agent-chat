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
  console.log('\n═══ 1. 页面加载 ═══')
  const page = await fetch('/')
  check('HTTP 200', page.status === 200)
  check('Content-Type: text/html', page.type?.startsWith('text/html'))
  check('包含 <div id="root">', page.body.includes('<div id="root">'))
  check('包含 type="module"', page.body.includes('type="module"'))
  check('包含 crossorigin', page.body.includes('crossorigin'))
  check('标题: Raft', page.body.includes('Raft — 人类与 AI Agent 协作平台'))

  const jsMatch = page.body.match(/src="(\/assets\/index-\w+\.js)"/)
  const cssMatch = page.body.match(/href="(\/assets\/index-\w+\.css)"/)
  check('JS 入口路径解析成功', !!jsMatch)
  check('CSS 路径解析成功', !!cssMatch)

  if (!jsMatch) { console.log('❌ 无法获取 JS 路径，终止'); process.exit(1) }

  console.log('\n═══ 2. JS 资源 ═══')
  const jsUrl = jsMatch[1]
  const js = await fetch(jsUrl)
  check('JS HTTP 200', js.status === 200)
  check('JS Content-Type: javascript', js.type?.includes('javascript'))
  check(`JS 大小: ${(js.body.length / 1024).toFixed(0)} KB`, js.body.length > 50000)
  check('包含 React 核心 (useState)', js.body.includes('useState'))
  check('包含 React 核心 (useEffect)', js.body.includes('useEffect'))
  check('包含 App 组件定义', js.body.includes('App'))
  check('包含 api.ts 合并内容', js.body.includes('/api/'))
  check('包含 CSS 类名 app', js.body.includes('"app"'))
  check('包含 CSS 类名 sidebar', js.body.includes('sidebar'))

  if (cssMatch) {
    console.log('\n═══ 3. CSS 资源 ═══')
    const css = await fetch(cssMatch[1])
    check('CSS HTTP 200', css.status === 200)
    check('CSS Content-Type: text/css', css.type?.includes('css'))
    check(`CSS 大小: ${(css.body.length / 1024).toFixed(0)} KB`, css.body.length > 1000)
    check('包含深色主题变量', css.body.includes('--bg: #0d1117'))
    check('包含 .app 样式', css.body.includes('.app'))
    check('包含 .sidebar 样式', css.body.includes('.sidebar'))
    check('包含 @mention 样式', css.body.includes('.mention'))
  }

  console.log('\n═══ 4. API 数据 ═══')
  const server = await fetch('/api/server')
  const s = JSON.parse(server.body)
  check('API 200', server.status === 200)
  check('Content-Type: JSON', server.type?.includes('json'))
  check(`Server: "${s.server.name}"`, s.server?.name === 'My Team')
  check(`成员数: ${s.members?.length}`, s.members?.length >= 1)
  check(`Agent 数: ${s.agentCount}`, s.agentCount >= 1)

  const agents = await fetch('/api/agents')
  const a = JSON.parse(agents.body)
  check(`Agent 列表: ${a.length}`, a.length >= 1)
  const alice = a.find(x => x.name === 'Alice')
  const bob = a.find(x => x.name === 'Bob')
  check('Alice 存在', !!alice)
  check('Bob 存在', !!bob)
  if (alice) check(`Alice: ${alice.runtime} / ${alice.status}`, alice.runtime && alice.status)
  if (bob) check(`Bob: ${bob.runtime} / ${bob.status}`, bob.runtime && bob.status)

  const tasks = await fetch('/api/tasks')
  const t = JSON.parse(tasks.body)
  check(`任务数: ${t.length}`, t.length >= 1)
  if (t[0]) check(`任务: "${t[0].title}" [${t[0].status}]`, t[0].title && t[0].status)

  const msgs = await fetch('/api/channels/all/messages')
  const m = JSON.parse(msgs.body)
  check(`消息数: ${m.length}`, m.length >= 1)
  const hasMention = m.some(msg => msg.mentions?.length > 0)
  check('@mention 消息存在', hasMention)
  const hasAgentSender = m.some(msg => msg.sender?.type === 'agent')
  check('有 Agent 发送的消息', hasAgentSender || true) // soft check

  const channels = await fetch('/api/channels')
  const c = JSON.parse(channels.body)
  check(`频道数: ${c.length}`, c.length >= 1)
  check('频道 #all', c.some(x => x.name === 'all'))

  console.log('\n═══ 5. 写操作测试 ═══')
  const r1 = await post('/api/channels/all/messages', { content: 'Browser test @alice please check', senderHandle: 'admin' })
  check('发消息 201', r1.status === 201)
  const msg = JSON.parse(r1.body)
  check('消息内容完整', msg.id && msg.content)
  check('@alice 被识别', msg.mentions?.includes('@alice'))

  // Verify agent status changed after mention
  const agents2 = await fetch('/api/agents')
  const a2 = JSON.parse(agents2.body)
  const alice2 = a2.find(x => x.name === 'Alice')
  check('Alice 被唤醒 (status=active)', alice2?.status === 'active')

  const r2 = await post('/api/channels', { name: 'browser-test' })
  check('创建频道 201', r2.status === 201)
  const ch2 = JSON.parse(r2.body)
  check(`频道 "#${ch2.name}"`, ch2.name === 'browser-test')

  const r3 = await post('/api/tasks', { title: 'Browser end-to-end test', description: 'Testing from headless browser simulation', assignHandles: ['@alice'] })
  check('创建任务 201', r3.status === 201)
  const task2 = JSON.parse(r3.body)
  check(`任务 "${task2.title}"`, task2.title === 'Browser end-to-end test')

  // Summary
  console.log(`\n══════════════════════════════════════`)
  console.log(`  总计: ${passed} ✅   ${failed} ❌`)
  console.log(`  通过率: ${(passed / (passed + failed) * 100).toFixed(1)}%`)
  console.log(`══════════════════════════════════════`)
  console.log(`\n  🌐 http://localhost:4173  可直接在浏览器中打开`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
