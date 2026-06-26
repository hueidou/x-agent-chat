# 开发指南

## 环境要求

- Node.js >= 20
- npm >= 9
- opencode CLI (用于 AI 运行时)
- PowerShell 7+ (Windows)

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/hueidou/x-agent-chat.git
cd x-agent-chat

# 2. 安装依赖
npm install
cd web && npm install && cd ..

# 3. 编译
npx tsc
cd web && npm run build && cd ..

# 4. 启动服务
node dist/server/index.js

# 5. 新终端：启动 Agent Worker
node dist/agent/index.js --server http://localhost:4173 --handle @alice --name Alice --runtime opencode
```

## 项目结构

```
x-agent-chat/
├── agent/                  # Agent Worker
│   ├── index.ts            # CLI 入口
│   ├── BridgeClient.ts     # 核心逻辑
│   ├── RuntimeAdapter.ts   # 运行时接口
│   └── adapters/
│       ├── OpenCode.ts     # opencode 适配器
│       ├── Claude.ts       # claude 适配器
│       └── index.ts        # 注册
├── server/
│   └── index.ts            # Express 服务器
├── src/
│   ├── types/              # 类型定义
│   ├── store/              # 数据存储
│   │   ├── FileStore.ts    # 文件持久化
│   │   └── MemoryStore.ts  # 内存存储
│   ├── runtime/            # 运行时相关
│   │   ├── AgentRuntime.ts
│   │   └── WakeBridge.ts
│   ├── cli/                # CLI 工具
│   ├── daemon/             # 守护进程
│   ├── models/             # 数据模型
│   └── server/             # 服务器相关
├── web/                    # 前端
│   ├── src/
│   │   ├── App.tsx         # 主组件
│   │   ├── App.css         # 样式
│   │   ├── api.ts          # API 客户端
│   │   ├── types.ts        # 类型定义
│   │   └── components/     # 组件
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/                   # 文档
├── examples/               # 示例
├── tests/                  # 测试
├── package.json
└── tsconfig.json
```

## 开发流程

### 1. 修改后端代码

```bash
# 编译
npx tsc

# 重启服务
node dist/server/index.js
```

### 2. 修改前端代码

```bash
# 开发模式 (热更新)
cd web
npm run dev

# 或者编译后重启服务
npm run build
```

### 3. 修改 Agent 代码

```bash
# 编译
npx tsc

# 重启 Worker
node dist/agent/index.js --server http://localhost:4173 --handle @alice --name Alice --runtime opencode
```

## 添加新的 RuntimeAdapter

### 1. 创建适配器文件

```typescript
// agent/adapters/NewRuntime.ts
import { spawn } from 'child_process'
import type { RuntimeAdapter, StreamCallbacks } from '../RuntimeAdapter.js'
import type { RuntimeType } from '../../src/types/index.js'

export class NewRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'new-runtime'

  isAvailable(): boolean {
    // 检查 CLI 是否可用
    try {
      execSync('new-runtime --version', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  async execute(prompt: string, callbacks?: StreamCallbacks): Promise<string> {
    // 实现调用逻辑
    // 使用 callbacks.onToken() 推送流式内容
    return 'response'
  }
}
```

### 2. 注册适配器

```typescript
// agent/adapters/index.ts
import { registerRuntime } from '../RuntimeAdapter.js'
import { NewRuntimeAdapter } from './NewRuntime.js'

registerRuntime('new-runtime', NewRuntimeAdapter)
```

### 3. 更新类型定义

```typescript
// src/types/agent.ts
export type RuntimeType = 
  | 'claude-code'
  | 'opencode'
  | 'new-runtime'  // 添加
```

## 测试

### API 测试

```bash
node test-agent.mjs
```

### 多轮对话测试

```bash
node test-multi-round.mjs
```

### Worker 流程测试

```bash
node test-worker-flow.mjs
```

## 调试

### 查看日志

Server 日志直接输出到控制台。Worker 日志也输出到控制台。

### 常见问题

1. **opencode 超时**
   - 检查 opencode 是否已登录
   - 检查网络连接
   - 增加超时时间

2. **消息不显示**
   - 检查 SSE 连接
   - 检查 @mention 格式

3. **流式不工作**
   - 确认使用 `--format json`
   - 检查 JSON 解析

## 代码规范

- 使用 ES Module
- TypeScript 严格模式
- 无注释（除非必要）
- 使用 `import type` 导入类型
- 使用 `.js` 扩展名导入（即使源文件是 .ts）

## 提交规范

```
feat: 新功能
fix: 修复
docs: 文档
style: 格式
refactor: 重构
test: 测试
chore: 构建/工具
```
