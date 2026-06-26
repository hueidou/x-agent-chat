import { registerRuntime } from '../RuntimeAdapter.js'
import { OpenCodeAdapter } from './OpenCode.js'
import { ClaudeAdapter } from './Claude.js'

registerRuntime('opencode', OpenCodeAdapter)
registerRuntime('claude-code', ClaudeAdapter)
