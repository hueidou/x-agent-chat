# Development Guide

## Requirements

- Node.js >= 20
- npm >= 9
- opencode CLI (for AI runtime)
- PowerShell 7+ (Windows)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/hueidou/x-agent-chat.git
cd x-agent-chat

# 2. Install dependencies
npm install
cd web && npm install && cd ..

# 3. Compile
npx tsc
cd web && npm run build && cd ..

# 4. Start the server
node dist/server/index.js

# 5. New terminal: Start Agent Worker
node dist/agent/index.js --server http://localhost:4173 --handle @alice --name Alice --runtime opencode
```

## Project Structure

```
x-agent-chat/
├── agent/                  # Agent Worker
│   ├── index.ts            # CLI entry point
│   ├── BridgeClient.ts     # Core logic
│   ├── RuntimeAdapter.ts   # Runtime interface
│   └── adapters/
│       ├── OpenCode.ts     # opencode adapter
│       ├── Claude.ts       # claude adapter
│       └── index.ts        # Registration
├── server/
│   └── index.ts            # Express server
├── src/
│   ├── types/              # Type definitions
│   ├── store/              # Data storage
│   │   ├── FileStore.ts    # File persistence
│   │   └── MemoryStore.ts  # In-memory storage
│   ├── runtime/            # Runtime related
│   │   ├── AgentRuntime.ts
│   │   └── WakeBridge.ts
│   ├── cli/                # CLI tools
│   ├── daemon/             # Daemon process
│   ├── models/             # Data models
│   └── server/             # Server related
├── web/                    # Frontend
│   ├── src/
│   │   ├── App.tsx         # Main component
│   │   ├── App.css         # Styles
│   │   ├── api.ts          # API client
│   │   ├── types.ts        # Type definitions
│   │   └── components/     # Components
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/                   # Documentation
├── examples/               # Examples
├── tests/                  # Tests
├── package.json
└── tsconfig.json
```

## Development Workflow

### 1. Modify Backend Code

```bash
# Compile
npx tsc

# Restart the server
node dist/server/index.js
```

### 2. Modify Frontend Code

```bash
# Development mode (hot reload)
cd web
npm run dev

# Or compile and restart the server
npm run build
```

### 3. Modify Agent Code

```bash
# Compile
npx tsc

# Restart the Worker
node dist/agent/index.js --server http://localhost:4173 --handle @alice --name Alice --runtime opencode
```

## Adding a New RuntimeAdapter

### 1. Create Adapter File

```typescript
// agent/adapters/NewRuntime.ts
import { spawn } from 'child_process'
import type { RuntimeAdapter, StreamCallbacks } from '../RuntimeAdapter.js'
import type { RuntimeType } from '../../src/types/index.js'

export class NewRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'new-runtime'

  isAvailable(): boolean {
    // Check if CLI is available
    try {
      execSync('new-runtime --version', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  async execute(prompt: string, callbacks?: StreamCallbacks): Promise<string> {
    // Implement call logic
    // Use callbacks.onToken() to push streaming content
    return 'response'
  }
}
```

### 2. Register Adapter

```typescript
// agent/adapters/index.ts
import { registerRuntime } from '../RuntimeAdapter.js'
import { NewRuntimeAdapter } from './NewRuntime.js'

registerRuntime('new-runtime', NewRuntimeAdapter)
```

### 3. Update Type Definitions

```typescript
// src/types/agent.ts
export type RuntimeType = 
  | 'claude-code'
  | 'opencode'
  | 'new-runtime'  // Add
```

## Testing

### API Test

```bash
node test-agent.mjs
```

### Multi-Round Conversation Test

```bash
node test-multi-round.mjs
```

### Worker Flow Test

```bash
node test-worker-flow.mjs
```

## Debugging

### Viewing Logs

Server logs are output directly to the console. Worker logs are also output to the console.

### Common Issues

1. **opencode timeout**
   - Check if opencode is logged in
   - Check network connection
   - Increase timeout duration

2. **Messages not displaying**
   - Check SSE connection
   - Check @mention format

3. **Streaming not working**
   - Confirm using `--format json`
   - Check JSON parsing

## Code Standards

- Use ES Module
- TypeScript strict mode
- No comments (unless necessary)
- Use `import type` for type imports
- Use `.js` extension for imports (even if source file is .ts)

## Commit Convention

```
feat: New feature
fix: Bug fix
docs: Documentation
style: Formatting
refactor: Refactoring
test: Testing
chore: Build/tools
```
