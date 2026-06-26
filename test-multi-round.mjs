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
  console.log('  Multi-round conversation test')
  console.log('═'.repeat(55))

  // 1. Start Server
  console.log('\n[1] Starting server...')
  const serverProc = spawn('node', ['dist/server/index.js'], {
    cwd: 'C:\\Users\\hueid\\Desktop\\workspace\\dosomething\\raft-core',
    stdio: 'ignore'
  })
  await sleep(3000)

  // 2. Create Agent
  console.log('[2] Creating Agent...')
  await req('POST', '/api/agents', { name: 'Alice', description: 'Developer', runtime: 'opencode' })

  // 3. Start Worker
  console.log('[3] Starting Worker...')
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

  // 4. Multi-round conversation
  const rounds = [
    'What is 1+1? Reply with just the number',
    'What about 2+2?',
    'What about 3+3?',
    'What about 4+4?',
  ]

  let pass = 0
  for (let i = 0; i < rounds.length; i++) {
    const q = rounds[i]
    console.log(`\n--- Round ${i+1} ---`)
    console.log(`Sent: @alice ${q}`)

    await req('POST', '/api/channels/all/messages', {
      content: `@alice ${q}`,
      senderHandle: 'admin'
    })

    console.log('Waiting for reply...')
    const msgs = await waitForReply()
    if (msgs) {
      const agentMsgs = msgs.filter(m => m.sender?.type === 'agent')
      const reply = agentMsgs[agentMsgs.length - 1]
      console.log(`Received: ${reply.content}`)
      pass++
    } else {
      console.log(`❌ Timeout! Round ${i+1} no reply`)
      break
    }
  }

  // 5. Results
  console.log('\n' + '═'.repeat(55))
  console.log(`  Result: ${pass}/${rounds.length} rounds passed`)
  console.log('═'.repeat(55))

  serverProc.kill()
  workerProc.kill()
  process.exit(pass === rounds.length ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
