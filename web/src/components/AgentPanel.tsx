import type { Agent } from '../types'

interface Props {
  agents: Agent[]
  onWake: (handle: string) => void
}

const runtimeColors: Record<string, string> = {
  opencode: '#58a6ff',
  'claude-code': '#a371f7',
  'codex-cli': '#3fb950',
  'gemini-cli': '#d29922',
  'kimi-cli': '#f85149',
}

export default function AgentPanel({ agents, onWake }: Props) {
  return (
    <div className="panel-body">
      {agents.length === 0 ? (
        <div className="empty-state" style={{ height: 120 }}>
          <div className="big">🤖</div>
          <div>暂无 Agent</div>
        </div>
      ) : agents.map(a => (
        <div key={a.id} className="agent-card">
          <div className={`agent-dot ${a.status}`} />
          <div className="agent-info">
            <div className="agent-name">{a.name}</div>
            <div className="agent-desc">{a.description}</div>
          </div>
          <span className="agent-runtime" style={{
            borderColor: runtimeColors[a.runtime] || 'var(--border)',
            color: runtimeColors[a.runtime] || 'var(--text-dim)',
          }}>{a.runtime}</span>
        </div>
      ))}
    </div>
  )
}
