import http from 'http'
import { spawn } from 'child_process'

const BASE = 'http://localhost:4173'
const TIMEOUT = 90000

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const opts = { method, hostname: 'localhost', port: 4173, path, headers: { 'Content-Type': 'application/json' } }
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data)
    const r = http.request(opts, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }) }
        catch { resolve({ status: res.statusCode, body: d }) }
      })
    })
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function waitForReply(timeout = TIMEOUT) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const msgs = await req('GET', '/api/channels/all/messages')
    const agentMsgs = msgs.body.filter(m => m.sender?.type === 'agent')
    const adminMsgs = msgs.body.filter(m => m.sender?.type === 'human' && m.sender?.handle === 'admin')
    if (agentMsgs.length >= adminMsgs.length) return msgs.body
    await sleep(2000)
  }
  return null
}

async function main() {
  console.log('═'.repeat(55))
  console.log('  多轮对话测试')
  console.log('═'.repeat(55))

  // 1. 启动 Server
  console.log('\n[1] 启动服务器...')
  const serverProc = spawn('node', ['dist/server/index.js'], {
    cwd: 'C:\\Users\\hueid\\Desktop\\workspace\\dosomething\\raft-core',
    stdio: 'ignore'
  })
  await sleep(3000)

  // 2. 创建 Agent
  console.log('[2] 创建 Agent...')
  await req('POST', '/api/agents', { name: 'Alice', description: 'Developer', runtime: 'opencode' })

  // 3. 启动 Worker
  console.log('[3] 启动 Worker...')
  const workerProc = spawn('node', [
    'dist/agent/index.js', '--server', BASE,
    '--handle', '@alice', '--name', 'Alice', '--runtime', 'opencode'
  ], {
    cwd: 'C:\\Users\\hueid\\Desktop\\workspace\\dosomething\\raft-core',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  workerProc.stdout.on('data', d => process.stdout.write(`   [worker] ${d}`))
  workerProc.stderr.on('data', d => process.stdout.write(`   [worker] ${d}`))
  await sleep(3000)

  // 4. 多轮对话
  const rounds = [
    '1+1等于多少?只回答数字',
    '2+2呢?',
    '3+3呢?',
    '4+4呢?',
  ]

  let pass = 0
  for (let i = 0; i < rounds.length; i++) {
    const q = rounds[i]
    console.log(`\n--- 第 ${i+1} 轮 ---`)
    console.log(`发送: @alice ${q}`)

    await req('POST', '/api/channels/all/messages', {
      content: `@alice ${q}`,
      senderHandle: 'admin'
    })

    console.log('等待回复...')
    const msgs = await waitForReply()
    if (msgs) {
      const agentMsgs = msgs.filter(m => m.sender?.type === 'agent')
      const reply = agentMsgs[agentMsgs.length - 1]
      console.log(`收到: ${reply.content}`)
      pass++
    } else {
      console.log(`❌ 超时! 第 ${i+1} 轮无回复`)
      break
    }
  }

  // 5. 结果
  console.log('\n' + '═'.repeat(55))
  console.log(`  结果: ${pass}/${rounds.length} 轮通过`)
  console.log('═'.repeat(55))

  serverProc.kill()
  workerProc.kill()
  process.exit(pass === rounds.length ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
