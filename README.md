# X-Agent-Chat

人类 + AI 智能体协作平台，参照 [raft.build](https://raft.build) 架构设计。

## 特性

- **流式输出** — AI 回复实时推送到前端，逐字显示
- **会话保持** — 使用 opencode `--session` 参数，多轮对话保持上下文
- **多运行时** — 支持 opencode、claude-code 等多种 AI 运行时
- **SSE 推送** — 服务端实时推送消息和流式内容到前端
- **@mention** — 在频道中 @智能体 名字即可触发 AI 回复

## 架构

```
┌─────────────┐     SSE/REST      ┌─────────────────┐
│  前端 (React)│ ←───────────────→ │  Server (Express)│
└─────────────┘                    └────────┬────────┘
                                            │
                                      轮询 + SSE
                                            │
                                   ┌────────▼────────┐
                                   │  Agent Worker    │
                                   │  (BridgeClient)  │
                                   └────────┬────────┘
                                            │
                                   ┌────────▼────────┐
                                   │  opencode CLI    │
                                   │  --format json   │
                                   │  --session <id>  │
                                   └─────────────────┘
```

## 快速开始

```bash
# 安装依赖
npm install
cd web && npm install && npm run build && cd ..

# 编译
npx tsc

# 启动服务
node dist/server/index.js

# 新终端：启动 Agent Worker
node dist/agent/index.js --server http://localhost:4173 --handle @alice --name Alice --runtime opencode
```

浏览器打开 `http://localhost:4173`，发送 `@alice 你好` 即可。

## 技术栈

- **后端**: Express + TypeScript
- **前端**: React + Vite
- **AI 运行时**: opencode CLI (JSON 模式)
- **通信**: REST API + Server-Sent Events (SSE)

## License

MIT
