import { spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { StringDecoder } from 'string_decoder'
import type { RuntimeAdapter, StreamCallbacks } from '../RuntimeAdapter.js'
import type { RuntimeType } from '../../src/types/index.js'

function findOc(): string | null {
  const npmDir = process.env.APPDATA ? join(process.env.APPDATA, 'npm') : null
  if (npmDir) {
    const exe = join(npmDir, 'node_modules', 'opencode-ai', 'bin', 'opencode.exe')
    if (existsSync(exe)) return exe
    const cmd = join(npmDir, 'opencode.cmd')
    if (existsSync(cmd)) return cmd
  }
  return null
}

const ocBinary = findOc()

export class OpenCodeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'opencode'
  private workDir: string
  private sessionId: string | null = null

  constructor() {
    this.workDir = join(tmpdir(), 'raft-agent', `opencode-${Date.now()}`)
    if (!existsSync(this.workDir)) mkdirSync(this.workDir, { recursive: true })
  }

  isAvailable(): boolean {
    return ocBinary !== null
  }

  async execute(prompt: string, callbacks?: StreamCallbacks): Promise<string> {
    if (!ocBinary) throw new Error('opencode binary not found')

    const args = [
      'run',
      '--format', 'json',
      '--pure',
      '--dir', this.workDir,
      '--dangerously-skip-permissions',
    ]
    if (this.sessionId) {
      args.push('--session', this.sessionId)
    }
    args.push('--', prompt)

    return new Promise<string>((resolve, reject) => {
      const child = spawn(ocBinary, args, {
        cwd: this.workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      const decoder = new StringDecoder('utf8')
      let buffer = ''
      let fullText = ''

      child.stdout.on('data', (chunk: Buffer) => {
        buffer += decoder.write(chunk)
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let event: any
          try { event = JSON.parse(trimmed) } catch { continue }

          if (event.sessionID && event.sessionID !== this.sessionId) {
            this.sessionId = event.sessionID
            callbacks?.onSession?.(event.sessionID)
          }

          switch (event.type) {
            case 'step_start':
              callbacks?.onThinking?.('')
              break
            case 'text':
              if (typeof event.part?.text === 'string' && event.part.text.length > 0) {
                fullText += event.part.text
                callbacks?.onToken?.(event.part.text)
              }
              break
            case 'tool_use':
              callbacks?.onToolCall?.(event.part?.tool || 'unknown', event.part?.state?.input)
              break
            case 'tool_output':
              callbacks?.onToolOutput?.(event.part?.tool || 'unknown')
              break
            case 'step_finish':
              if (event.part?.reason !== 'tool-calls') {
                callbacks?.onDone?.(fullText)
              }
              break
            case 'error': {
              const msg = event.error?.data?.message || event.error?.message || 'Unknown OpenCode error'
              callbacks?.onError?.(msg)
              break
            }
          }
        }
      })

      let stderr = ''
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('opencode timed out after 300s'))
      }, 300000)

      child.on('close', (code) => {
        clearTimeout(timer)
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim())
            if (event.sessionID && event.sessionID !== this.sessionId) {
              this.sessionId = event.sessionID
              callbacks?.onSession?.(event.sessionID)
            }
            if (event.type === 'text' && event.part?.text) {
              fullText += event.part.text
              callbacks?.onToken?.(event.part.text)
            }
            if (event.type === 'step_finish' && event.part?.reason !== 'tool-calls') {
              callbacks?.onDone?.(fullText)
            }
          } catch {}
        }
        if (code !== 0 && !fullText) {
          reject(new Error(`opencode exited with code ${code}: ${stderr.slice(0, 200)}`))
        } else {
          if (!fullText) callbacks?.onDone?.('')
          resolve(fullText)
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }
}
