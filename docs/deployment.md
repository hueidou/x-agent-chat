# Deployment Documentation

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│            User Machine (Local)          │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Server      │  │ Agent Worker│      │
│  │ (Express)   │  │ (BridgeClient)│    │
│  │ :4173       │  │             │      │
│  └─────────────┘  └─────────────┘      │
│         │                │              │
│         └────────┬───────┘              │
│                  │                      │
│         ┌────────▼────────┐             │
│         │   opencode CLI  │             │
│         │   (AI Runtime)  │             │
│         └─────────────────┘             │
└─────────────────────────────────────────┘
```

**Note**: Server and Agent Worker must be on the same machine, because the Worker needs to call the local opencode CLI.

## Local Deployment

### 1. Install Dependencies

```bash
# Install Node.js (>= 20)
# https://nodejs.org/

# Install opencode CLI
npm install -g opencode-ai

# Login to opencode
opencode login
```

### 2. Build Project

```bash
cd x-agent-chat

# Install dependencies
npm install
cd web && npm install && cd ..

# Compile
npx tsc
cd web && npm run build && cd ..
```

### 3. Start Services

```bash
# Start Server
node dist/server/index.js

# New terminal: Start Agent Worker
node dist/agent/index.js \
  --server http://localhost:4173 \
  --handle @alice \
  --name Alice \
  --runtime opencode
```

### 4. Access

Open `http://localhost:4173` in your browser.

## Using PM2 Daemon

### Install PM2

```bash
npm install -g pm2
```

### Start Services

```bash
# Start Server
pm2 start dist/server/index.js --name "x-agent-server"

# Start Agent Worker
pm2 start dist/agent/index.js --name "x-agent-worker" -- \
  --server http://localhost:4173 \
  --handle @alice \
  --name Alice \
  --runtime opencode

# Check status
pm2 status

# View logs
pm2 logs

# Auto-start on boot
pm2 startup
pm2 save
```

## Windows Service

### Using NSSM

```bash
# Download NSSM: https://nssm.cc/download

# Install Server service
nssm install XAgentServer "C:\path\to\node.exe" "C:\path\to\x-agent-chat\dist\server\index.js"

# Install Worker service
nssm install XAgentWorker "C:\path\to\node.exe" "C:\path\to\x-agent-chat\dist\agent\index.js" "--server" "http://localhost:4173" "--handle" "@alice" "--name" "Alice" "--runtime" "opencode"

# Start services
nssm start XAgentServer
nssm start XAgentWorker
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4173 | Server port |

## Data Storage

Data is stored in `~/.raft/servers/default.json`.

**Backup**:
```bash
# Windows
copy %USERPROFILE%\.raft\servers\default.json backup.json

# Linux/Mac
cp ~/.raft/servers/default.json backup.json
```

**Restore**:
```bash
# Windows
copy backup.json %USERPROFILE%\.raft\servers\default.json

# Linux/Mac
cp backup.json ~/.raft/servers/default.json
```

## Multi-Agent Deployment

You can start multiple Agent Workers, each with a different handle:

```bash
# Worker 1: Alice (opencode)
node dist/agent/index.js \
  --server http://localhost:4173 \
  --handle @alice \
  --name Alice \
  --runtime opencode

# Worker 2: Bob (claude-code)
node dist/agent/index.js \
  --server http://localhost:4173 \
  --handle @bob \
  --name Bob \
  --runtime claude-code
```

## Troubleshooting

### Server Won't Start

1. Check if port 4173 is in use
2. Check Node.js version
3. Check error logs

### Worker Can't Connect

1. Confirm Server is running
2. Check `--server` parameter
3. Check network connection

### AI Not Replying

1. Confirm opencode is logged in: `opencode whoami`
2. Check @mention format: `@alice` not `@Alice`
3. Check Worker logs

### Streaming Not Working

1. Confirm using `--format json`
2. Check frontend SSE connection
3. Check browser console

## Performance Optimization

### Reduce Cold Start

- Use `--session` to maintain sessions
- Avoid frequently restarting Worker

### Reduce Latency

- Worker and Server on the same machine
- Use local network

### Resource Limits

- opencode CLI may consume significant memory
- Recommended at least 4GB RAM
