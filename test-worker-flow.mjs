import { spawn } from 'child_process'
import http from 'http'

const BASE = 'http://localhost:4173'

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) })) })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))) }).on('error', reject)
  })
}

async function main() {
  // 1. Reset state
  console.log('=== 创建 Agent ===')
  await post('/api/agents', { name: 'Alice', description: 'Developer', runtime: 'opencode' })
  const agents = await get('/api/agents')
  console.log(`  Agent: ${agents.map(a => `${a.name}(${a.handle})`).join(', ')}`)

  // 2. Start Agent Worker as subprocess
  console.log('\n=== 启动 Agent Worker ===')
  const workerPath = 'C:\\Users\\hueid\\Desktop\\workspace\\dosomething\\raft-core\\dist\\agent\\index.js'
  const worker = spawn('node', [workerPath, '--server', BASE, '--handle', '@alice', '--name', 'Alice', '--runtime', 'opencode'], {
    cwd: 'C:\\Users\\hueid\\Desktop\\workspace\\dosomething\\raft-core',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  worker.stdout.on('data', d => console.log(`  [worker] ${d.toString().trim()}`))
  worker.stderr.on('data', d => console.log(`  [worker-err] ${d.toString().trim()}`))

  // Wait for worker to start
  await new Promise(r => setTimeout(r, 3000))

  // 3. Send message mentioning @alice
  console.log('\n=== 发送 @alice 消息 ===')
  const msg = await post('/api/channels/all/messages', {
    content: '@alice Reply with just the number: what is 7 * 8?',
    senderHandle: 'admin'
  })
  console.log(`  已发送: ${msg.body.content}`)

  // 4. Wait for worker to process (opencode cold start)
  console.log('\n=== 等待 Agent 回复 (opencode 冷启动约 30-60s) ===')
  const startTime = Date.now()
  let replyFound = false

  while (Date.now() - startTime < 120000) {
    await new Promise(r => setTimeout(r, 3000))
    const msgs = await get('/api/channels/all/messages')
    const agentMsgs = msgs.filter(m => m.sender.type === 'agent')
    if (agentMsgs.length > 0) {
      console.log(`\n✅ Agent 已回复 (${Math.round((Date.now() - startTime) / 1000)}s)!`)
      for (const m of agentMsgs) {
        console.log(`   [${m.sender.name}] ${m.content}`)
      }
      replyFound = true
      break
    }
    process.stdout.write('.')
  }

  // 5. Cleanup
  worker.kill()

  if (!replyFound) {
    console.log('\n❌ 超时: Agent 未在 120s 内回复')
    process.exit(1)
  }

  console.log('\n=== ✅ Worker 完整流程通过 ===')
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
