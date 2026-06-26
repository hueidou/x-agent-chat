import type { RuntimeType } from '../src/types/index.js'

export interface StreamCallbacks {
  onToken?: (text: string) => void
  onThinking?: (text: string) => void
  onToolCall?: (name: string, input: any) => void
  onToolOutput?: (name: string) => void
  onSession?: (sessionId: string) => void
  onDone?: (fullText: string) => void
  onError?: (message: string) => void
}

export interface RuntimeAdapter {
  readonly type: RuntimeType
  execute(prompt: string, callbacks?: StreamCallbacks): Promise<string>
  isAvailable(): boolean
}

const registry = new Map<RuntimeType, new () => RuntimeAdapter>()

export function registerRuntime(type: RuntimeType, ctor: new () => RuntimeAdapter): void {
  registry.set(type, ctor)
}

export function getRuntimeAdapter(type: RuntimeType): RuntimeAdapter | null {
  const ctor = registry.get(type)
  if (!ctor) return null
  const adapter = new ctor()
  return adapter.isAvailable() ? adapter : null
}

export function listAvailableAdapters(): RuntimeType[] {
  const result: RuntimeType[] = []
  for (const [type, ctor] of registry) {
    const adapter = new ctor()
    if (adapter.isAvailable()) result.push(type)
  }
  return result
}
