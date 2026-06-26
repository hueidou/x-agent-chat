import { getRuntimeAdapter, listAvailableAdapters } from './RuntimeAdapter.js'
import type { RuntimeAdapter, StreamCallbacks } from './RuntimeAdapter.js'
import './adapters/index.js'

interface AgentConfig {
  serverUrl: string
  handle: string
  runtime: string
  name: string
}

export class BridgeClient {
  private serverUrl: string
  private handle: string
  private runtime: string
  private name: string
  private polling = false
  private lastSeenTs = 0

  constructor(config: AgentConfig) {
    this.serverUrl = config.serverUrl.replace(/\/+$/, '')
    this.handle = config.handle.startsWith('@') ? config.handle : `@${config.handle}`
    this.runtime = config.runtime
    this.name = config.name
  }

  async start(): Promise<void> {
    const adapter = getRuntimeAdapter(this.runtime as any)
    if (!adapter) {
      const available = listAvailableAdapters()
      console.log(`❌ 运行时 "${this.runtime}" 不可用。可用: ${available.join(', ') || '无'}`)
      process.exit(1)
    }

    console.log(`🤖 ${this.name} (${this.handle}) 已启动`)
    console.log(`   运行时: ${adapter.type}`)
    console.log(`   服务器: ${this.serverUrl}`)
    console.log(`   监听 @mention...`)

    this.polling = true
    await this.pollLoop(adapter)
  }

  stop(): void {
    this.polling = false
  }

  private async pollLoop(adapter: RuntimeAdapter): Promise<void> {
    while (this.polling) {
      try {
        await this.checkMessages(adapter)
      } catch (err: any) {
        console.error(`   [!] ${err.message || err}`)
      }
      await sleep(3000)
    }
  }

  private async checkMessages(adapter: RuntimeAdapter): Promise<void> {
    const chRes = await fetch(`${this.serverUrl}/api/channels`)
    if (!chRes.ok) { console.error(`   [!] 无法获取频道列表: ${chRes.status}`); return }
    const channels: any[] = await chRes.json()

    for (const ch of channels) {
      const msgRes = await fetch(`${this.serverUrl}/api/channels/${ch.name}/messages`)
      if (!msgRes.ok) continue
      const messages: any[] = await msgRes.json()

      const newMessages = messages.filter(m =>
        new Date(m.createdAt).getTime() > this.lastSeenTs &&
        m.sender.handle !== this.handle &&
        m.mentions?.includes(this.handle)
      )

      for (const msg of newMessages) {
        const ts = new Date(msg.createdAt).getTime()
        if (ts > this.lastSeenTs) this.lastSeenTs = ts
        console.log(`\n📨 [${ch.name}] ${msg.sender.name}: ${msg.content}`)
        await this.handleMessage(ch.name, msg, adapter)
      }

      if (messages.length > 0) {
        const last = messages[messages.length - 1]
        const ts = new Date(last.createdAt).getTime()
        if (ts > this.lastSeenTs) this.lastSeenTs = ts
      }
    }
  }

  private async handleMessage(
    channelName: string,
    msg: any,
    adapter: RuntimeAdapter
  ): Promise<void> {
    const prompt = this.buildPrompt(channelName, msg)
    console.log(`   ⏳ ${this.name} 正在思考...`)

    try {
      let streamingContent = ''
      let lastPushTs = 0

      const callbacks: StreamCallbacks = {
        onToken: (text: string) => {
          streamingContent += text
          const now = Date.now()
          if (now - lastPushTs > 500) {
            lastPushTs = now
            this.pushStreamUpdate(channelName, streamingContent, 'streaming').catch(() => {})
          }
        },
        onSession: (sessionId: string) => {
          console.log(`   🔗 会话: ${sessionId}`)
        },
        onDone: (fullText: string) => {
          console.log(`   ✅ ${this.name} 获得 AI 回复 (${fullText.length} 字符)`)
        },
        onError: (message: string) => {
          console.error(`   ⚠️ OpenCode 错误: ${message}`)
        },
      }

      const reply = await adapter.execute(prompt, callbacks)

      if (reply && reply.trim()) {
        await this.pushStreamUpdate(channelName, reply.trim(), 'done')
        const res = await fetch(`${this.serverUrl}/api/channels/${channelName}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: reply.trim(), senderHandle: this.handle }),
        })
        if (res.ok) {
          console.log(`   ✅ ${this.name} 已回复: ${reply.trim().slice(0, 80)}...`)
        } else {
          const txt = await res.text().catch(() => '')
          console.error(`   ❌ 回复发送失败: ${res.status} ${txt}`)
        }
      }
    } catch (err: any) {
      console.error(`   ❌ ${this.name} 处理失败: ${err.message}`)
      console.error(`   ${err.stack?.split('\n').slice(0, 3).join('\n')}`)
    }
  }

  private async pushStreamUpdate(
    channelName: string,
    content: string,
    status: 'streaming' | 'done'
  ): Promise<void> {
    try {
      await fetch(`${this.serverUrl}/api/channels/${channelName}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentHandle: this.handle,
          agentName: this.name,
          content,
          status,
        }),
      })
    } catch {}
  }

  private buildPrompt(channel: string, msg: any): string {
    return `You are ${this.name} (${this.handle}), an AI agent on a Raft collaboration platform.

A team member mentioned you in channel #${channel}. Respond helpfully.

Message from ${msg.sender.name}:
${msg.content}

Reply in Chinese or English as appropriate. Keep your response concise and actionable.`
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
