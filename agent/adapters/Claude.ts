import { execSync } from 'child_process'
import type { RuntimeAdapter } from '../RuntimeAdapter.js'
import type { RuntimeType } from '../../src/types/index.js'

export class ClaudeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'claude-code'

  isAvailable(): boolean {
    try {
      execSync('claude --version', { stdio: 'ignore', timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  async execute(prompt: string): Promise<string> {
    const result = execSync(
      `echo "${prompt.replace(/"/g, '\\"')}" | claude -p`,
      { encoding: 'utf-8', timeout: 120000, maxBuffer: 1024 * 1024 }
    )
    return result.trim()
  }
}
