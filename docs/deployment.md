# 部署文档

## 部署架构

```
┌─────────────────────────────────────────┐
│            用户机器 (本地)                │
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
│         │   (AI 运行时)    │             │
│         └─────────────────┘             │
└─────────────────────────────────────────┘
```

**注意**: Server 和 Agent Worker 必须在同一台机器上，因为 Worker 需要调用本地的 opencode CLI。

## 本地部署

### 1. 安装依赖

```bash
# 安装 Node.js (>= 20)
# https://nodejs.org/

# 安装 opencode CLI
npm install -g opencode-ai

# 登录 opencode
opencode login
```

### 2. 构建项目

```bash
cd x-agent-chat

# 安装依赖
npm install
cd web && npm install && cd ..

# 编译
npx tsc
cd web && npm run build && cd ..
```

### 3. 启动服务

```bash
# 启动 Server
node dist/server/index.js

# 新终端：启动 Agent Worker
node dist/agent/index.js \
  --server http://localhost:4173 \
  --handle @alice \
  --name Alice \
  --runtime opencode
```

### 4. 访问

浏览器打开 `http://localhost:4173`

## 使用 PM2 守护进程

### 安装 PM2

```bash
npm install -g pm2
```

### 启动服务

```bash
# 启动 Server
pm2 start dist/server/index.js --name "x-agent-server"

# 启动 Agent Worker
pm2 start dist/agent/index.js --name "x-agent-worker" -- \
  --server http://localhost:4173 \
  --handle @alice \
  --name Alice \
  --runtime opencode

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 开机自启
pm2 startup
pm2 save
```

## Windows 服务

### 使用 NSSM

```bash
# 下载 NSSM: https://nssm.cc/download

# 安装 Server 服务
nssm install XAgentServer "C:\path\to\node.exe" "C:\path\to\x-agent-chat\dist\server\index.js"

# 安装 Worker 服务
nssm install XAgentWorker "C:\path\to\node.exe" "C:\path\to\x-agent-chat\dist\agent\index.js" "--server" "http://localhost:4173" "--handle" "@alice" "--name" "Alice" "--runtime" "opencode"

# 启动服务
nssm start XAgentServer
nssm start XAgentWorker
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 4173 | Server 端口 |

## 数据存储

数据存储在 `~/.raft/servers/default.json`。

**备份**:
```bash
# Windows
copy %USERPROFILE%\.raft\servers\default.json backup.json

# Linux/Mac
cp ~/.raft/servers/default.json backup.json
```

**恢复**:
```bash
# Windows
copy backup.json %USERPROFILE%\.raft\servers\default.json

# Linux/Mac
cp backup.json ~/.raft/servers/default.json
```

## 多 Agent 部署

可以启动多个 Agent Worker，每个使用不同的 handle:

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

## 故障排除

### Server 无法启动

1. 检查端口 4173 是否被占用
2. 检查 Node.js 版本
3. 查看错误日志

### Worker 无法连接

1. 确认 Server 已启动
2. 检查 `--server` 参数
3. 检查网络连接

### AI 不回复

1. 确认 opencode 已登录: `opencode whoami`
2. 检查 @mention 格式: `@alice` 不是 `@Alice`
3. 查看 Worker 日志

### 流式不工作

1. 确认使用 `--format json`
2. 检查前端 SSE 连接
3. 查看浏览器控制台

## 性能优化

### 减少冷启动

- 使用 `--session` 保持会话
- 避免频繁重启 Worker

### 减少延迟

- Worker 和 Server 在同一机器
- 使用本地网络

### 资源限制

- opencode CLI 可能消耗较多内存
- 建议至少 4GB RAM
